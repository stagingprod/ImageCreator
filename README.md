# AI Image Generator & Canvas Editor

A powerful web-based image generation and editing application that combines AI-powered image generation with a feature-rich canvas editor. Create stunning images using DALL-E 3 and edit them with an intuitive visual interface.

![Python](https://img.shields.io/badge/python-v3.13+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-v3.1.1+-green.svg)
![OpenAI](https://img.shields.io/badge/OpenAI-DALL--E--3-orange.svg)
![Fabric.js](https://img.shields.io/badge/Fabric.js-v5.3.1-red.svg)

## 🌟 Features

### AI Image Generation
- **DALL-E 3 Integration**: Generate high-quality images using OpenAI's latest DALL-E 3 model
- **Multiple Image Sizes**: Support for various output sizes (1024x1024, 1792x1024, 1024x1792)
- **Batch Generation**: Generate multiple images at once
- **API Key Rotation**: Automatic rotation of multiple OpenAI API keys for increased reliability
- **Image Proxy**: Built-in CORS proxy for seamless image loading

### Canvas Editor
- **Multi-layered Editing**: Advanced layer management with drag-and-drop reordering
- **Text Tools**: Rich text editing with font customization, colors, and effects
- **Drawing Tools**: Freehand drawing with customizable brushes and colors
- **Shape Tools**: Add rectangles, circles, triangles, and custom shapes
- **Image Manipulation**: Upload, resize, crop, and position images
- **Emoji Support**: Quick emoji insertion for fun designs
- **Background Options**: Transparent or solid color backgrounds

### Advanced Features
- **Zoom Controls**: Smooth zoom in/out with fit-to-screen option
- **Undo/Redo**: Full history management for all operations
- **Export Options**: Save as PNG, JPEG, PDF, or SVG
- **Responsive Design**: Works on desktop and mobile devices
- **Auto-save Warning**: Prevents accidental data loss

## 🚀 Quick Start

### Prerequisites
- Python 3.13+
- OpenAI API key(s)

### Installation


1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   # Single API key
   OPENAI_API_KEY="your-openai-api-key-here"
   
   # Or multiple keys for rotation
   OPENAI_API_KEY_1="your-first-api-key"
   OPENAI_API_KEY_2="your-second-api-key"
   OPENAI_API_KEY_3="your-third-api-key"
   ```

3. **Run the application**
   ```bash
   python main.py
   ```

4. **Open your browser**
   
   Navigate to `http://localhost:5000`

## 📁 Project Structure

```
Image-Generator/
├── main.py                 # Flask application entry point
├── services/
│   ├── api_rotator.py     # OpenAI API key rotation logic
│   └── image_generator.py  # DALL-E image generation functions
├── templates/
│   ├── index.html         # Main canvas editor interface
│   └── raw-editor.html    # Alternative simple editor
├── static/
│   └── js/
│       └── script.js      # Frontend JavaScript logic
├── requirements.txt       # Python dependencies
├── pyproject.toml        # Project configuration
├── .env                  # Environment variables (not in repo)
└── README.md            # This file
```

## 🎨 How to Use

### Generating AI Images

1. **Enter Keywords**: Type descriptive keywords for your desired image
2. **Select Size**: Choose from available image dimensions
3. **Set Quantity**: Specify how many images to generate (1-10)
4. **Generate**: Click the generate button and wait for results
5. **Add to Canvas**: Click on any generated image to add it to your canvas

### Canvas Editing

1. **Select Tools**: Use the toolbar to switch between text, drawing, shapes, etc.
2. **Manage Layers**: Use the sidebar to organize, hide, or delete layers
3. **Customize**: Adjust colors, fonts, sizes, and effects using the controls
4. **Export**: Save your creation in your preferred format

### Keyboard Shortcuts

- `Ctrl+Z` / `Cmd+Z`: Undo
- `Ctrl+Y` / `Cmd+Y`: Redo
- `Delete`: Remove selected object
- `Ctrl+A` / `Cmd+A`: Select all objects

## 🔧 API Endpoints

### Generate Images
```http
POST /v1/generate_images
Content-Type: application/json

{
  "keywords": ["cyberpunk", "city", "neon lights"],
  "size": "1024x1024",
  "num_images": 2
}
```

### Proxy Image
```http
GET /proxy-image?url=<image-url>
```

## ⚙️ Configuration

### API Key Rotation
The application supports multiple OpenAI API keys for better reliability:

```python
# In your .env file
OPENAI_API_KEY_1="sk-xxx"
OPENAI_API_KEY_2="sk-yyy"
OPENAI_API_KEY_3="sk-zzz"
```

### Canvas Settings
Default canvas dimensions and other settings can be modified in `script.js`:

```javascript
let canvasWidth = 800;
let canvasHeight = 600;
```

## 🛠️ Development

### Tech Stack
- **Backend**: Flask (Python)
- **Frontend**: HTML5 Canvas with Fabric.js
- **AI**: OpenAI DALL-E 3 API
- **Styling**: Custom CSS with responsive design

### Key Libraries
- `Flask`: Web framework
- `OpenAI`: AI image generation
- `Fabric.js`: Canvas manipulation
- `python-dotenv`: Environment variable management

### Adding New Features

1. **Backend**: Add new routes in `main.py`
2. **Frontend**: Extend functionality in `script.js`
3. **Services**: Add new services in the `services/` directory

## 🔒 Security Notes

- Never commit your `.env` file to version control
- Keep your OpenAI API keys secure
- Consider implementing rate limiting for production use
- The image proxy endpoint should be secured in production

## 🐛 Troubleshooting

### Common Issues

1. **"No OpenAI API keys found"**
   - Check your `.env` file exists and contains valid API keys
   - Ensure the `.env` file is in the project root directory

2. **Canvas not loading**
   - Check browser console for JavaScript errors
   - Ensure Fabric.js CDN is accessible

3. **Images not generating**
   - Verify your OpenAI API key has sufficient credits
   - Check the Flask console for error messages

### Debug Mode
Run the application in debug mode for detailed error information:
```bash
export FLASK_ENV=development
python main.py
```

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

**Happy Creating! 🎨✨**