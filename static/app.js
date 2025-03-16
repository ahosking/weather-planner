class WeatherPlanner {
    constructor() {
        this.citySearch = document.getElementById('citySearch');
        this.cityResults = document.getElementById('cityResults');
        this.startDate = document.getElementById('startDate');
        this.endDate = document.getElementById('endDate');
        this.refreshButton = document.getElementById('refreshButton');
        this.itinerary = document.getElementById('itinerary');
        this.weatherResults = document.getElementById('weatherResults');
        
        this.selectedCities = new Map(); // date -> city data
        this.debounceTimer = null;
        this.hasApiError = false;
        
        this.setupEventListeners();
        this.loadFromStorage();
        this.updateRefreshButton();
    }

    setupEventListeners() {
        this.citySearch.addEventListener('input', () => this.handleCitySearch());
        this.citySearch.addEventListener('focus', () => this.showCityResults());
        document.addEventListener('click', (e) => this.handleClickOutside(e));
        
        this.startDate.addEventListener('change', () => this.handleDateChange());
        this.endDate.addEventListener('change', () => this.handleDateChange());
        this.refreshButton.addEventListener('click', () => this.refreshWeather());
        
        // Enable the date inputs with today as min date
        const today = new Date().toISOString().split('T')[0];
        this.startDate.min = today;
        this.endDate.min = today;
    }

    handleCitySearch() {
        clearTimeout(this.debounceTimer);
        const query = this.citySearch.value.trim();
        
        if (query.length < 3) {
            this.cityResults.innerHTML = '';
            this.cityResults.classList.remove('show');
            return;
        }

        this.debounceTimer = setTimeout(async () => {
            try {
                const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
                const cities = await response.json();
                
                this.cityResults.innerHTML = '';
                
                if (response.status === 200 && cities.length === 0 && !this.hasApiError) {
                    this.hasApiError = true;
                    const div = document.createElement('div');
                    div.className = 'city-result-item text-danger';
                    div.innerHTML = `
                        <p class="mb-0">The weather service is currently unavailable.</p>
                        <small>New API keys take up to 2 hours to activate.</small>
                    `;
                    this.cityResults.appendChild(div);
                    this.cityResults.classList.add('show');
                    return;
                }
                
                cities.forEach(city => {
                    const div = document.createElement('div');
                    div.className = 'city-result-item';
                    div.textContent = city.display;
                    div.addEventListener('click', () => this.selectCity(city));
                    this.cityResults.appendChild(div);
                });
                
                this.cityResults.classList.add('show');
            } catch (error) {
                console.error('Error searching cities:', error);
                this.cityResults.innerHTML = `
                    <div class="city-result-item text-danger">
                        <p class="mb-0">Error searching cities.</p>
                        <small>Please try again later.</small>
                    </div>
                `;
                this.cityResults.classList.add('show');
            }
        }, 300);
    }

    showCityResults() {
        if (this.cityResults.children.length > 0) {
            this.cityResults.classList.add('show');
        }
    }

    handleClickOutside(event) {
        if (!this.citySearch.contains(event.target) && !this.cityResults.contains(event.target)) {
            this.cityResults.classList.remove('show');
        }
    }

    selectCity(city) {
        if (!this.startDate.value) {
            alert('Please select a start date first');
            return;
        }

        const date = this.startDate.value;
        if (this.selectedCities.has(date)) {
            alert('A city is already selected for this date');
            return;
        }

        this.selectedCities.set(date, city);
        this.citySearch.value = '';
        this.cityResults.classList.remove('show');
        
        this.updateItinerary();
        this.fetchWeatherForCity(date, city);
        this.saveToStorage();
        this.updateRefreshButton();
    }

    handleDateChange() {
        if (this.startDate.value && this.endDate.value) {
            if (this.startDate.value > this.endDate.value) {
                this.endDate.value = this.startDate.value;
            }
        }
    }

    updateItinerary() {
        this.itinerary.innerHTML = '';
        const sortedEntries = Array.from(this.selectedCities.entries())
            .sort((a, b) => a[0].localeCompare(b[0]));
            
        sortedEntries.forEach(([date, city]) => {
            const div = document.createElement('div');
            div.className = 'itinerary-item';
            div.innerHTML = `
                <div>
                    <strong>${new Date(date).toLocaleDateString()}</strong>
                    <span>${city.display}</span>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="weatherPlanner.removeCity('${date}')">
                    Remove
                </button>
            `;
            this.itinerary.appendChild(div);
        });
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
        const forecast = data.list.find(item => {
            const itemDate = new Date(item.dt * 1000);
            return itemDate.toDateString() === new Date(date).toDateString();
        }) || data.list[0];
        
        card.querySelector('.card-title').textContent = city.display;
        card.querySelector('.card-subtitle').textContent = new Date(date).toLocaleDateString();
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
        card.querySelector('.weather-icon').remove();
        card.querySelector('.temperature').textContent = 'Weather data not available';
        card.querySelector('.description').innerHTML = 'The weather service is currently unavailable.<br><small>New API keys take up to 2 hours to activate. Please try again later.</small>';
        
        card.querySelector('.remove-btn').addEventListener('click', () => this.removeCity(date));
        
        this.weatherResults.appendChild(card);
        this.sortWeatherCards();
    }

    sortWeatherCards() {
        const cards = Array.from(this.weatherResults.children);
        cards.sort((a, b) => {
            const dateA = a.getAttribute('data-date');
            const dateB = b.getAttribute('data-date');
            return dateA.localeCompare(dateB);
        });
        
        // Reappend cards in sorted order
        cards.forEach(card => this.weatherResults.appendChild(card));
    }

    removeCity(date) {
        this.selectedCities.delete(date);
        this.updateItinerary();
        
        const card = this.weatherResults.querySelector(`[data-date="${date}"]`);
        if (card) {
            card.remove();
        }
        
        this.saveToStorage();
        this.updateRefreshButton();
    }

    refreshWeather() {
        this.selectedCities.forEach((city, date) => {
            this.fetchWeatherForCity(date, city);
        });
    }

    updateRefreshButton() {
        this.refreshButton.disabled = this.selectedCities.size === 0;
    }

    saveToStorage() {
        const data = {
            cities: Array.from(this.selectedCities.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, city]) => ({
                    date,
                    city
                }))
        };
        localStorage.setItem('weatherPlannerData', JSON.stringify(data));
    }

    loadFromStorage() {
        const savedData = localStorage.getItem('weatherPlannerData');
        if (savedData) {
            const data = JSON.parse(savedData);
            // Sort the saved cities by date before loading
            data.cities.sort((a, b) => a.date.localeCompare(b.date));
            
            data.cities.forEach(item => {
                this.selectedCities.set(item.date, item.city);
            });
            
            this.updateItinerary();
            // Load weather data in date order
            data.cities.forEach(item => {
                this.fetchWeatherForCity(item.date, item.city);
            });
        }
    }
}

const weatherPlanner = new WeatherPlanner();
