from flask import Flask, jsonify, request, send_file, render_template # type: ignore
from io import BytesIO
import requests # type: ignore
from services.image_generator import generate_images_with_dalle
from services.api_rotator import APIKeyRotator

app = Flask(__name__)
rotator = APIKeyRotator()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/v1/generate_images', methods=['POST'])
def generate_images():
    data = request.get_json() or request.form

    keywords = data.get('keywords', [])
    size = data.get('size', '1024x1024')
    num_images = int(data.get('num_images', 1))

    if not keywords:
        return jsonify({"error": "No keywords provided"}), 400
    if num_images < 1 or num_images > 10:
        return jsonify({"error": "Number of images must be between 1 and 10"}), 400

    try:
        api_key = rotator.get_openai_key()
        images = generate_images_with_dalle(keywords, api_key, size=size, num_images=num_images)
        return jsonify({"images": images})

    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

# Add this new route to your Flask app
@app.route('/proxy-image', methods=['GET'])
def proxy_image():
    """Proxy for images to avoid CORS issues"""
    image_url = request.args.get('url')
    if not image_url:
        return jsonify({"error": "No image URL provided"}), 400
    
    try:
        # Fetch the image from the external URL
        response = requests.get(image_url)
        response.raise_for_status()  # Raise an error for bad responses
        
        # Create a BytesIO object from the image data
        image_data = BytesIO(response.content)
        
        # Send the image data as a file response
        return send_file(
            image_data,
            mimetype=response.headers.get('content-type', 'image/png')
        )
    except Exception as e:
        return jsonify({"error": f"Failed to proxy image: {str(e)}"}), 500 
    
if __name__ == '__main__':
    app.run(debug=True)