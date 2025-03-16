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

@app.route('/api/cities', methods=['GET'])
def search_cities():
    query = request.args.get('q', '')
    if len(query) < 3:
        return jsonify([])
    
    url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit=5&appid={OPENWEATHER_API_KEY}"
    response = requests.get(url)
    
    if response.status_code != 200:
        return jsonify([])
    
    cities = response.json()
    formatted_cities = [{
        'name': city.get('name'),
        'state': city.get('state', ''),
        'country': city.get('country'),
        'lat': city.get('lat'),
        'lon': city.get('lon'),
        'display': f"{city.get('name')}{', ' + city.get('state') if city.get('state') else ''}, {city.get('country')}"
    } for city in cities]
    
    return jsonify(formatted_cities)

@app.route('/api/weather', methods=['POST'])
def get_weather():
    data = request.json
    lat = data.get('lat')
    lon = data.get('lon')
    
    if not lat or not lon:
        return jsonify({"error": "Location coordinates required"}), 400
        
    # Get weather forecast
    weather_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
    weather_response = requests.get(weather_url)
    
    if weather_response.status_code != 200:
        return jsonify({"error": "Weather data not available"}), 500
        
    return jsonify(weather_response.json())

if __name__ == '__main__':
    app.run(debug=True)
