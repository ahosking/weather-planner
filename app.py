from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from dotenv import load_dotenv
import requests
from datetime import datetime, timedelta
import argparse

load_dotenv()

app = Flask(__name__)
CORS(app)

OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')
if not OPENWEATHER_API_KEY:
    raise ValueError("OpenWeather API key not found in environment variables")


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)


@app.route('/api/cities', methods=['GET'])
def search_cities():
    query = request.args.get('q', '')
    if len(query) < 3:
        return jsonify([])

    url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit=5&appid={OPENWEATHER_API_KEY}"
    print(f"Searching cities with URL: {url}")  # Debug log

    try:
        response = requests.get(url)
        print(f"OpenWeather API Response: {response.status_code}")  # Debug log
        print(f"Response content: {response.text}")  # Debug log

        if response.status_code != 200:
            print(f"Error from OpenWeather API: {response.text}")  # Debug log
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
    except Exception as e:
        print(f"Error in search_cities: {str(e)}")  # Debug log
        return jsonify([])


@app.route('/api/weather', methods=['POST'])
def get_weather():
    data = request.json
    lat = data.get('lat')
    lon = data.get('lon')

    if not lat or not lon:
        return jsonify({"error": "Location coordinates required"}), 400

    # Get weather forecast using OneCall API with daily forecasts
    weather_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
    print(f"Fetching weather with URL: {weather_url}")  # Debug log

    try:
        weather_response = requests.get(weather_url)
        print(f"Weather API Response: {weather_response.status_code}")  # Debug log
        print(f"Response content: {weather_response.text}")  # Debug log

        if weather_response.status_code != 200:
            print(f"Error from Weather API: {weather_response.text}")  # Debug log
            return jsonify({"error": "Weather data not available"}), 500

        return jsonify(weather_response.json())
    except Exception as e:
        print(f"Error in get_weather: {str(e)}")  # Debug log
        return jsonify({"error": "Weather data not available"}), 500


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Weather Planner App')
    parser.add_argument('--host', default='127.0.0.1',
                        help='Host to run the server on')
    parser.add_argument('--port', type=int, default=5000,
                        help='Port to run the server on')
    args = parser.parse_args()

    print(f"\nStarting server on {args.host}:{args.port}")
    print("To access from other devices on your network, use your computer's IP address")
    app.run(host=args.host, port=args.port, debug=True)
