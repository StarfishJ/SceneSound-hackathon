import * as tf from '@tensorflow/tfjs';
import sharp from 'sharp';
import { places365Categories, sceneToMusicMapping, places365CategoryGroups } from './places365Config';

// Model path configuration
const MODEL_PATH = process.env.MODEL_PATH || './models/googlenet_places365/model.json';

// Scene recognition class
class SceneRecognizer {
  constructor() {
    this.model = null;
    this.categories = places365Categories;
    this.categoryGroups = places365CategoryGroups;
  }

  // Load model
  async loadModel() {
    if (!this.model) {
      try {
        this.model = await tf.loadGraphModel(MODEL_PATH);
        console.log('Scene recognition model loaded successfully');
      } catch (error) {
        console.error('Failed to load model:', error);
        throw new Error('Model loading failed');
      }
    }
    return this.model;
  }

  // Preprocess image
  async preprocessImage(imageBuffer) {
    // Resize image to 224x224
    const resizedImage = await sharp(imageBuffer)
      .resize(224, 224)
      .toBuffer();

    // Convert to tensor and normalize
    const tensor = tf.tidy(() => {
      const img = tf.node.decodeImage(resizedImage, 3);
      // Normalize to [0,1] range
      const normalized = img.div(255.0);
      // Expand dimensions to match model input
      return normalized.expandDims(0);
    });

    return tensor;
  }

  // Get scene category groups
  getCategoryGroup(scene) {
    for (const [group, categories] of Object.entries(this.categoryGroups)) {
      for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.includes(scene)) {
          return { group, category };
        }
      }
    }
    return null;
  }

  // Scene recognition
  async recognizeScene(imageBuffer) {
    try {
      // Ensure model is loaded
      await this.loadModel();

      // Preprocess image
      const inputTensor = await this.preprocessImage(imageBuffer);

      // Perform prediction
      const predictions = await tf.tidy(() => {
        const output = this.model.predict(inputTensor);
        return output.squeeze().arraySync();
      });

      // Clean up
      inputTensor.dispose();

      // Get top 5 prediction results
      const topPredictions = predictions
        .map((prob, idx) => ({
          scene: this.categories[idx],
          probability: prob
        }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5)
        .map(pred => ({
          ...pred,
          category: this.getCategoryGroup(pred.scene)
        }));

      // Get music mapping
      const musicStyles = this.getMusicStyles(topPredictions);

      return {
        scenes: topPredictions,
        musicStyles
      };
    } catch (error) {
      console.error('Scene recognition failed:', error);
      throw new Error('Scene recognition processing failed');
    }
  }

  // Get music style mapping
  getMusicStyles(predictions) {
    return predictions.map(pred => {
      const styles = sceneToMusicMapping[pred.scene] || [];
      return {
        scene: pred.scene,
        category: pred.category,
        styles: styles.map(style => ({
          name: style,
          weight: pred.probability
        }))
      };
    });
  }
}

// Export singleton instance
export const sceneRecognizer = new SceneRecognizer(); 