const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const tf = require('@tensorflow/tfjs-node');

const MODEL_DIR = path.join(__dirname, '../models/googlenet_places365');
const CLASSES_FILE = path.join(MODEL_DIR, 'categories_places365.txt');
const MODEL_URL = 'http://places2.csail.mit.edu/models_places365/googlenet_places365.caffemodel';
const PROTOTXT_URL = 'http://places2.csail.mit.edu/models_places365/deploy_googlenet_places365.prototxt';

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      fs.unlink(dest);
      reject(err);
    });
  });
}

async function convertModel() {
  // Ensure directory exists
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  try {
    console.log('Downloading Caffe model files...');
    await downloadFile(MODEL_URL, path.join(MODEL_DIR, 'googlenet_places365.caffemodel'));
    await downloadFile(PROTOTXT_URL, path.join(MODEL_DIR, 'deploy.prototxt'));

    console.log('Convert model to TensorFlow.js format...');
    // Use tensorflowjs_converter to convert model
    const command = `tensorflowjs_converter \
      --input_format=keras \
      --output_format=tfjs_layers_model \
      ${path.join(MODEL_DIR, 'googlenet_places365.caffemodel')} \
      ${path.join(MODEL_DIR, 'web_model')}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Conversion failed:', error);
        return;
      }
      console.log('Model conversion completed');
    });

    // Download category file
    console.log('Downloading category file...');
    const categoriesResponse = await fetch('https://raw.githubusercontent.com/CSAILVision/places365/master/categories_places365.txt');
    const categoriesText = await categoriesResponse.text();
    fs.writeFileSync(CLASSES_FILE, categoriesText);

    console.log('Model and category file preparation completed');
  } catch (error) {
    console.error('Error downloading or converting:', error);
  }
}

// Run conversion script
convertModel(); 