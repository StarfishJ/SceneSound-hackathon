import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import re
from typing import List, Dict, Tuple, Union
import os
import requests
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

class Places365Model:
    def __init__(self):
        """Initialize Places365 model"""
        logger.info("初始化 Places365 模型...")
        
        # Predefined scenes and confidence
        self.custom_scenes = {
            'beach': 0.85,
            'ocean': 0.75,
            'coast': 0.65,
            'sunset': 0.55
        }
        
        # Set device
        self.device = torch.device('cpu')
        logger.info(f"使用设备: {self.device}")
        
        try:
            # Initialize model
            logger.info("加载 ResNet18 模型...")
            self.model = models.resnet18(weights=None)
            self.model.fc = torch.nn.Linear(self.model.fc.in_features, 365)
            
            # Load pretrained weights
            weights_path = 'resnet18_places365.pth.tar'
            if not os.path.exists(weights_path):
                # 使用备用链接
                urls = [
                    'https://data.csail.mit.edu/places/places365/resnet18_places365.pth.tar',
                    'https://github.com/CSAILVision/places365/releases/download/v1/resnet18_places365.pth.tar'
                ]
                
                for url in urls:
                    try:
                        logger.info(f"尝试从 {url} 下载预训练模型权重...")
                        response = requests.get(url, timeout=30)
                        if response.status_code == 200:
                            with open(weights_path, 'wb') as f:
                                f.write(response.content)
                            logger.info("模型权重下载成功")
                            break
                    except Exception as e:
                        logger.warning(f"从 {url} 下载失败: {str(e)}")
                else:
                    raise Exception("无法下载模型权重文件")
            
            # Optimize weight loading process
            logger.info("加载模型权重...")
            checkpoint = torch.load(weights_path, map_location='cpu')
            state_dict = {str.replace(k, 'module.', ''): v 
                         for k, v in checkpoint['state_dict'].items()}
            self.model.load_state_dict(state_dict)
            del checkpoint, state_dict
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            
            self.model.eval()  # Set to evaluation mode
            logger.info("模型权重加载完成")
            
            # Optimize image preprocessing
            self.preprocess = transforms.Compose([
                transforms.Resize(256),
                transforms.CenterCrop(224),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
            
            # Load Places365 category labels
            logger.info("加载场景类别标签...")
            self.places365_labels = self._load_places365_labels()
            
            # Use TorchScript to optimize model
            logger.info("优化模型性能...")
            example = torch.randn(1, 3, 224, 224)
            self.model = torch.jit.trace(self.model, example)
            del example
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            
            logger.info("Places365 模型初始化完成")
            
        except Exception as e:
            logger.error(f"模型初始化失败: {str(e)}", exc_info=True)
            raise

    def _load_places365_labels(self) -> List[str]:
        """Load Places365 category labels"""
        if not os.path.exists('categories_places365.txt'):
            urls = [
                'https://raw.githubusercontent.com/CSAILVision/places365/master/categories_places365.txt',
                'https://data.csail.mit.edu/places/places365/categories_places365.txt'
            ]
            
            for url in urls:
                try:
                    logger.info(f"尝试从 {url} 下载类别标签...")
                    response = requests.get(url, timeout=10)
                    if response.status_code == 200:
                        with open('categories_places365.txt', 'wb') as f:
                            f.write(response.content)
                        logger.info("类别标签下载成功")
                        break
                except Exception as e:
                    logger.warning(f"从 {url} 下载失败: {str(e)}")
            else:
                raise Exception("无法下载类别标签文件")
        
        labels = []
        with open('categories_places365.txt', 'r') as f:
            for line in f:
                label = line.strip().split(' ')[0][3:]
                label = label.replace('/', '_')
                labels.append(label)
        return labels

    @torch.no_grad()
    def predict(self, image: Image.Image) -> List[Dict[str, Union[str, float]]]:
        """Predict scene, return top 5 most likely Places365 scenes"""
        try:
            if image is None:
                logger.warning("收到空图像")
                return []

            logger.info(f"开始处理图像，尺寸: {image.size}")
            
            # Preprocess image
            input_tensor = self.preprocess(image)
            input_batch = input_tensor.unsqueeze(0)
            
            # Perform prediction
            logger.info("执行场景预测...")
            output = self.model(input_batch)
            probabilities = torch.nn.functional.softmax(output[0], dim=0)
            
            # Get top 5 prediction results
            top5_prob, top5_idx = torch.topk(probabilities, 5)
            
            # Build prediction results
            predictions = []
            for prob, idx in zip(top5_prob, top5_idx):
                scene = self.places365_labels[idx]
                probability = float(prob)
                predictions.append({
                    'scene': scene,
                    'probability': probability
                })
                logger.info(f"预测场景: {scene}, 置信度: {probability:.4f}")
            
            # Clean up memory
            del input_tensor, input_batch, output, probabilities
            torch.cuda.empty_cache() if torch.cuda.is_available() else None
            
            return predictions
            
        except Exception as e:
            logger.error(f"预测过程中出错: {str(e)}", exc_info=True)
            return [] 