import { useState, useEffect} from 'react'
import './App.css'

function App() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    //Fetch data from the flask API
    fetch('http://127.0.0.1:500/api/hello')
    .then(response => response.json())
    .then(data => setMessage(data.message))
    .catch(error => console.error('Error fetching data from flask:', error));
    console.log(message)
    
  }, [])

  return (
    <div className="App">
     
    </div>
  )

}

export default App
