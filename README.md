# SceneSound

SceneSound is an innovative web application that generates personalized music playlists based on scene analysis from images or text descriptions. Using advanced AI technology, it analyzes visual scenes or textual descriptions to recommend music that matches the mood and atmosphere.

## Features

- **Scene Analysis**: Upload images or provide text descriptions to analyze the scene
- **Smart Music Recommendations**: Get personalized music recommendations based on scene analysis
- **Spotify Integration**: Preview songs and open them directly in Spotify
- **Responsive Design**: Fully responsive interface that works on both desktop and mobile devices
- **Real-time Processing**: Instant scene analysis and music recommendations
- **Multi-source Input**: Support for both image uploads and text descriptions

## Tech Stack

- **Frontend**:
  - Next.js
  - React
  - CSS Modules
  - Tailwind CSS

- **Backend**:
  - Python
  - Flask
  - PyTorch (Places365 model)
  - Spotify Web API

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Python 3.13
- Spotify Developer Account (for API access)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/StarfishJ/SceneSound-hackathon.git
cd SceneSound-hackathon
```

2. Download required large files:
   - Spotify tracks database (optional):
     - Will be automatically generated on first run
     - Or download pre-built database from [Google Drive]https://drive.google.com/file/d/1M0bb7IcOW-U4XdrpgtqF7bg7VmPNrhkc/view?usp=drive_link
     - Place it in `public/downloads/spotify/tracks.json`

3. Install frontend dependencies:
```bash
npm install
```

4. Install backend dependencies:
```bash
cd python_service
# Install PyTorch first
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu  # For CPU version
# OR
# pip install torch torchvision  # For GPU version

# Then install other dependencies
pip install flask flask-cors pillow python-dotenv requests
```

### Running the Application

1. Start the frontend development server:
```bash
cd SceneSound-hackathon  # Make sure you're in the project root
npm run dev
```

2. Start the backend server:
```bash
cd SceneSound-hackathon/python_service  # Use absolute path from wherever you are
python app.py
```

The application will be available at `http://localhost:3000`

## Usage

1. Open the application in your web browser
2. Either upload an image or enter a text description of a scene
3. Click "Analyze" to process the input
4. View the detected scenes and recommended music
5. Preview songs directly in the application or open them in Spotify

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Places365 model for scene recognition
- Spotify Web API for music recommendations
- All contributors and supporters of the project

## Large Files
Due to GitHub's file size limitations, the following files are not included in the repository:
- `python_service/resnet50_places365.pth.tar` (92.76 MB)
- `public/downloads/spotify/tracks.json` (135.48 MB)

Please download these files from the provided Google Drive links in the installation instructions.
