const API_KEY = '54598954-6489d2bf5b8d99e98e408af7c';
const carModel = 'Suzuki SX4'; // הרכב שלך

async function testPixabay() {
    const url = `https://pixabay.com/api/?key=${API_KEY}&q=${encodeURIComponent(carModel + " car")}&image_type=photo`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.hits.length > 0) {
            console.log("Success! Image URL found:");
            console.log(data.hits[0].largeImageURL);
        } else {
            console.log("No images found for this model.");
        }
    } catch (error) {
        console.log("Error:", error);
    }
}

testPixabay();