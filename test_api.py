import requests
import json
import os

def test_analyze_api():
    url = "http://localhost:8080/analyze"
    
    # Prepare test image file
    image_path = "test.jpg"
    if not os.path.exists(image_path):
        print(f"Please place a test image test.jpg in the {os.getcwd()} directory first")
        return
        
    files = {
        'image': ('test.jpg', open(image_path, 'rb'), 'image/jpeg')
    }
    
    try:
        response = requests.post(url, files=files)
        print("Status Code:", response.status_code)
        print("Response:", json.dumps(response.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print("Error:", str(e))
    finally:
        files['image'][1].close()

if __name__ == "__main__":
    test_analyze_api() 