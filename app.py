from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import requests
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__, static_folder='static')
CORS(app)

OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/weather', methods=['POST'])
def get_weather():
    data = request.json
    city = data.get('city')
    start_date = data.get('startDate')
    
    # Get coordinates for the city
    geo_url = f"http://api.openweathermap.org/geo/1.0/direct?q={city}&limit=1&appid={OPENWEATHER_API_KEY}"
    geo_response = requests.get(geo_url)
    
    if not geo_response.json():
        return jsonify({"error": "City not found"}), 404
        
    location = geo_response.json()[0]
    lat, lon = location['lat'], location['lon']
    
    # Get weather forecast
    weather_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
    weather_response = requests.get(weather_url)
    
    if weather_response.status_code != 200:
        return jsonify({"error": "Weather data not available"}), 500
        
    return jsonify({
        "weather": weather_response.json(),
        "city": {
            "name": location.get('name'),
            "country": location.get('country'),
            "state": location.get('state')
        }
    })

if __name__ == '__main__':
    app.run(debug=True)
