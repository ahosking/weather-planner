class WeatherPlanner {
    constructor() {
        this.form = document.getElementById('tripForm');
        this.cityInputs = document.getElementById('cityInputs');
        this.weatherResults = document.getElementById('weatherResults');
        this.startDate = document.getElementById('startDate');
        this.endDate = document.getElementById('endDate');
        
        this.setupEventListeners();
        this.loadFromStorage();
    }

    setupEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.startDate.addEventListener('change', () => this.updateCityInputs());
        this.endDate.addEventListener('change', () => this.updateCityInputs());
    }

    loadFromStorage() {
        const savedData = localStorage.getItem('weatherPlannerData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.startDate.value = data.startDate;
            this.endDate.value = data.endDate;
            this.updateCityInputs();
            
            // Fill in saved cities
            const cityInputs = this.cityInputs.querySelectorAll('.city-field');
            data.cities.forEach((city, index) => {
                if (cityInputs[index]) {
                    cityInputs[index].value = city;
                }
            });
        }
    }

    saveToStorage() {
        const cities = Array.from(this.cityInputs.querySelectorAll('.city-field'))
            .map(input => input.value);
            
        const data = {
            startDate: this.startDate.value,
            endDate: this.endDate.value,
            cities: cities
        };
        
        localStorage.setItem('weatherPlannerData', JSON.stringify(data));
    }

    updateCityInputs() {
        if (!this.startDate.value || !this.endDate.value) return;
        
        const start = new Date(this.startDate.value);
        const end = new Date(this.endDate.value);
        const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        this.cityInputs.innerHTML = '';
        
        for (let i = 0; i < days; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            
            const div = document.createElement('div');
            div.className = 'city-input mb-3';
            div.innerHTML = `
                <label class="form-label">Day ${i + 1} City - ${currentDate.toLocaleDateString()}</label>
                <input type="text" class="form-control city-field" required>
            `;
            
            this.cityInputs.appendChild(div);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        this.weatherResults.innerHTML = '';
        
        const cities = Array.from(this.cityInputs.querySelectorAll('.city-field'))
            .map(input => input.value);
            
        this.saveToStorage();
        
        const start = new Date(this.startDate.value);
        
        for (let i = 0; i < cities.length; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            
            try {
                const response = await fetch('/api/weather', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        city: cities[i],
                        startDate: currentDate.toISOString()
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Weather data not available');
                }
                
                const data = await response.json();
                this.displayWeather(data, currentDate, i + 1);
            } catch (error) {
                this.displayError(cities[i], i + 1);
            }
        }
    }

    displayWeather(data, date, dayNumber) {
        const template = document.getElementById('weatherCardTemplate');
        const card = template.content.cloneNode(true);
        
        // Find the forecast for our specific date
        const forecast = data.weather.list.find(item => {
            const itemDate = new Date(item.dt * 1000);
            return itemDate.toDateString() === date.toDateString();
        }) || data.weather.list[0];
        
        const cityName = `${data.city.name}${data.city.state ? ', ' + data.city.state : ''}, ${data.city.country}`;
        
        card.querySelector('.card-title').textContent = `Day ${dayNumber} - ${cityName}`;
        card.querySelector('.card-subtitle').textContent = date.toLocaleDateString();
        card.querySelector('.weather-icon img').src = 
            `https://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png`;
        card.querySelector('.temperature').textContent = 
            `${Math.round(forecast.main.temp)}°C (Feels like ${Math.round(forecast.main.feels_like)}°C)`;
        card.querySelector('.description').textContent = forecast.weather[0].description;
        
        this.weatherResults.appendChild(card);
    }

    displayError(city, dayNumber) {
        const template = document.getElementById('weatherCardTemplate');
        const card = template.content.cloneNode(true);
        
        card.querySelector('.card-title').textContent = `Day ${dayNumber} - ${city}`;
        card.querySelector('.card-subtitle').textContent = 'Error';
        card.querySelector('.weather-icon').remove();
        card.querySelector('.temperature').textContent = 'Weather data not available';
        card.querySelector('.description').textContent = 'Please check the city name and try again';
        
        this.weatherResults.appendChild(card);
    }
}

new WeatherPlanner();
