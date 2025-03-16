class WeatherPlanner {
    constructor() {
        this.citySearch = document.getElementById('citySearch');
        this.cityResults = document.getElementById('cityResults');
        this.weatherResults = document.getElementById('weatherResults');
        this.startDate = document.getElementById('startDate');
        this.endDate = document.getElementById('endDate');
        this.refreshButton = document.getElementById('refreshButton');
        this.selectedCities = new Map();
        
        this.setupEventListeners();
        this.loadFromStorage();
        this.updateRefreshButton();
    }
    
    setupEventListeners() {
        this.citySearch.addEventListener('input', () => this.handleCitySearch());
        this.citySearch.addEventListener('focus', () => this.showCityResults());
        document.addEventListener('click', (e) => this.handleClickOutside(e));
        this.startDate.addEventListener('change', () => this.handleDateChange());
        this.refreshButton.addEventListener('click', () => this.refreshWeather());
        
        // Enable the date inputs with today as min date
        const today = new Date().toISOString().split('T')[0];
        this.startDate.min = today;
    }

    handleCitySearch() {
        const query = this.citySearch.value.trim();
        if (query.length < 3) {
            this.cityResults.innerHTML = '<div class="city-result-item text-danger"><p>Please enter at least 3 characters</p></div>';
            return;
        }

        fetch(`/api/cities?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(cities => {
                if (cities.length === 0) {
                    this.cityResults.innerHTML = '<div class="city-result-item text-danger"><p>No cities found</p></div>';
                    return;
                }

                this.cityResults.innerHTML = cities
                    .map(city => `
                        <div class="city-result-item" data-lat="${city.lat}" data-lon="${city.lon}">
                            <p>${city.display}</p>
                            <small>${city.country}</small>
                        </div>
                    `)
                    .join('');

                this.cityResults.querySelectorAll('.city-result-item').forEach(item => {
                    if (!item.classList.contains('text-danger')) {
                        item.addEventListener('click', () => {
                            const city = {
                                lat: parseFloat(item.dataset.lat),
                                lon: parseFloat(item.dataset.lon),
                                display: item.querySelector('p').textContent
                            };
                            this.selectCity(city);
                        });
                    }
                });
            })
            .catch(error => {
                console.error('Error searching cities:', error);
                this.cityResults.innerHTML = '<div class="city-result-item text-danger"><p>Error searching cities</p></div>';
            });
    }

    showCityResults() {
        this.cityResults.classList.add('show');
        if (!this.citySearch.value.trim()) {
            this.cityResults.innerHTML = '<div class="city-result-item text-danger"><p>Please enter a city name</p></div>';
        }
    }

    handleClickOutside(event) {
        if (!this.cityResults.contains(event.target) && event.target !== this.citySearch) {
            this.cityResults.classList.remove('show');
        }
    }

    selectCity(city) {
        if (!this.startDate.value) {
            alert('Please select a date first');
            return;
        }

        const date = this.startDate.value;
        
        // Check if date already has a city
        if (this.selectedCities.has(date)) {
            alert('A city is already selected for this date');
            return;
        }

        this.selectedCities.set(date, city);
        this.fetchWeatherForCity(date, city);

        this.citySearch.value = '';
        this.cityResults.classList.remove('show');
        this.updateItinerary();
        this.saveToStorage();
        this.updateRefreshButton();
    }

    handleDateChange() {
        // No need to do anything when date changes
        // We'll keep all existing forecasts
    }

    async fetchWeatherForCity(date, city) {
        try {
            const response = await fetch('/api/weather', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    lat: city.lat,
                    lon: city.lon
                })
            });
            
            if (!response.ok) {
                throw new Error('Weather data not available');
            }
            
            const data = await response.json();
            this.displayWeather(data, date, city);
        } catch (error) {
            console.error('Error fetching weather:', error);
            this.displayError(city.display, date);
        }
    }

    displayWeather(data, date, city) {
        // Remove existing weather card for this date if it exists
        const existingCard = this.weatherResults.querySelector(`[data-date="${date}"]`);
        if (existingCard) {
            existingCard.remove();
        }

        const template = document.getElementById('weatherCardTemplate');
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.weather-card');
        cardElement.setAttribute('data-date', date);
        
        // Find the forecast for our specific date
        const targetDate = new Date(date);
        const forecast = data.list.find(item => {
            const itemDate = new Date(item.dt * 1000);
            return itemDate.toDateString() === targetDate.toDateString();
        });

        if (!forecast) {
            this.displayError(city.display, date);
            return;
        }
        
        card.querySelector('.card-title').textContent = city.display;
        card.querySelector('.card-subtitle').textContent = targetDate.toLocaleDateString();
        card.querySelector('.weather-icon img').src = 
            `https://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png`;
        card.querySelector('.temperature').textContent = 
            `${Math.round(forecast.main.temp)}°C (Feels like ${Math.round(forecast.main.feels_like)}°C)`;
        card.querySelector('.description').textContent = forecast.weather[0].description;
        
        card.querySelector('.remove-btn').addEventListener('click', () => this.removeCity(date));
        
        this.weatherResults.appendChild(card);
        this.sortWeatherCards();
    }

    displayError(cityName, date) {
        const template = document.getElementById('weatherCardTemplate');
        const card = template.content.cloneNode(true);
        const cardElement = card.querySelector('.weather-card');
        cardElement.setAttribute('data-date', date);
        
        card.querySelector('.card-title').textContent = cityName;
        card.querySelector('.card-subtitle').textContent = new Date(date).toLocaleDateString();
        card.querySelector('.weather-icon').style.display = 'none';
        card.querySelector('.temperature').textContent = 'N/A';
        card.querySelector('.description').innerHTML = '<small>Forecast not available</small>';
        
        card.querySelector('.remove-btn').addEventListener('click', () => this.removeCity(date));
        
        this.weatherResults.appendChild(card);
        this.sortWeatherCards();
    }

    removeCity(date) {
        this.selectedCities.delete(date);
        
        const card = this.weatherResults.querySelector(`[data-date="${date}"]`);
        if (card) {
            card.remove();
        }
        
        this.updateItinerary();
        this.saveToStorage();
        this.updateRefreshButton();
    }

    refreshWeather() {
        Array.from(this.selectedCities.entries()).forEach(([date, city]) => {
            this.fetchWeatherForCity(date, city);
        });
    }

    updateRefreshButton() {
        this.refreshButton.style.display = this.selectedCities.size > 0 ? 'block' : 'none';
    }

    sortWeatherCards() {
        const cards = Array.from(this.weatherResults.children);
        cards.sort((a, b) => {
            const dateA = a.getAttribute('data-date');
            const dateB = b.getAttribute('data-date');
            return dateA.localeCompare(dateB);
        });
        
        this.weatherResults.innerHTML = '';
        cards.forEach(card => this.weatherResults.appendChild(card));
    }

    updateItinerary() {
        const itinerary = document.getElementById('itinerary');
        itinerary.innerHTML = '';
        
        Array.from(this.selectedCities.entries())
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .forEach(([date, city]) => {
                const item = document.createElement('div');
                item.className = 'itinerary-item';
                item.innerHTML = `
                    <div>
                        <strong>${new Date(date).toLocaleDateString()}</strong>
                        ${city.display}
                    </div>
                    <button class="btn btn-sm btn-outline-danger remove-btn" data-date="${date}">
                        Remove
                    </button>
                `;
                
                item.querySelector('.remove-btn').addEventListener('click', () => this.removeCity(date));
                itinerary.appendChild(item);
            });
    }

    saveToStorage() {
        const data = Array.from(this.selectedCities.entries()).map(([date, city]) => ({
            date,
            city
        }));
        localStorage.setItem('weatherPlanner', JSON.stringify(data));
    }

    loadFromStorage() {
        const data = localStorage.getItem('weatherPlanner');
        if (data) {
            JSON.parse(data).forEach(item => {
                this.selectedCities.set(item.date, item.city);
                this.fetchWeatherForCity(item.date, item.city);
            });
            this.updateItinerary();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.weatherPlanner = new WeatherPlanner();
});
