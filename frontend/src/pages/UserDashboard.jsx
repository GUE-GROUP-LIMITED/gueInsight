import React, { useEffect, useState, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import axios from 'axios';

const UserDashboard = () => {
  const [reports, setReports] = useState([]);
  const [file, setFile] = useState(null);
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [chartData, setChartData] = useState(null);
  const chartRef = useRef(null);

  useEffect(() => {
    // Fetch reports (replace with your API endpoint)
    axios.get('/api/reports').then(res => setReports(res.data)).catch(() => setReports([]));
    // Fetch chart data
    axios.get('/get_analysis_data').then(res => setChartData(res.data));
  }, []);

  useEffect(() => {
    if (chartData && chartRef.current) {
      Plotly.newPlot(chartRef.current, [{
        x: chartData.categories,
        y: chartData.values,
        type: 'bar',
        marker: { color: 'rgba(55,128,191,0.6)', line: { color: 'rgba(55,128,191,1)', width: 1 } },
        hoverinfo: 'x+y',
      }], {
        title: 'Threat Categories Analysis',
        xaxis: { title: 'Threat Categories' },
        yaxis: { title: 'Occurrences' },
        margin: { t: 30, l: 50, r: 30, b: 50 },
        barmode: 'stack',
        responsive: true,
      });
    }
  }, [chartData]);

  const handleFileChange = e => setFile(e.target.files[0]);
  const handleFileUpload = async e => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    await axios.post('/upload', formData);
    // Optionally refresh reports or chart
  };
  const handleTextSubmit = async e => {
    e.preventDefault();
    await axios.post('/user_dashboard', { pasted_input: textInput });
  };
  const handleUrlSubmit = async e => {
    e.preventDefault();
    await axios.post('/user_dashboard', { cloud_link: urlInput });
  };

  return (
    <div className="container mt-4">
      <h2>User Dashboard</h2>
      {/* Reports Section */}
      <section>
        <h3>Your Reports</h3>
        {reports.length ? (
          <ul>
            {reports.map(report => (
              <li key={report.id}>
                <a href={`/download_report/${report.id}`} className="btn btn-primary">Download {report.name}</a>
                <a href={`/email_report/${report.id}`} className="btn btn-secondary ms-2">Send via Email</a>
              </li>
            ))}
          </ul>
        ) : <p>No reports available. Submit a file or input to generate one.</p>}
      </section>
      {/* Get Started Section */}
      <section className="get-started how-it-works py-5 bg-secondary text-white" id="get-started">
        <h2>Get Started with GueInsight</h2>
        <p>Ready to strengthen your defenses? GueInsight offers tools for threat detection, real-time analytics, and ransomware protection. Here’s how our platform works:</p>
        <ol>
          <li><strong>Input Layer:</strong> Collect data from various sources.</li>
          <li><strong>Preprocessing Layer:</strong> Clean and prepare the data.</li>
          <li><strong>Analysis Layer:</strong> Detect threats and anomalies in real time.</li>
          <li><strong>Visualization Layer:</strong> Present actionable insights through interactive dashboards and reports.</li>
        </ol>
        <a href="/subscription" className="btn btn-primary">Start Using GueInsight</a>
      </section>
      {/* Submission Tabs */}
      <section className="mt-4">
        <h3>Submit for Analysis</h3>
        <div className="card">
          <div className="card-header">
            <ul className="nav nav-tabs card-header-tabs" id="submissionTabs" role="tablist">
              <li className="nav-item"><button className="nav-link active" data-bs-toggle="tab" data-bs-target="#file">File Upload</button></li>
              <li className="nav-item"><button className="nav-link" data-bs-toggle="tab" data-bs-target="#text">Text/Hash Submission</button></li>
              <li className="nav-item"><button className="nav-link" data-bs-toggle="tab" data-bs-target="#url">URL Submission</button></li>
            </ul>
          </div>
          <div className="card-body">
            <div className="tab-content">
              <div className="tab-pane fade show active" id="file">
                <h5>Upload a File</h5>
                <form onSubmit={handleFileUpload}>
                  <input type="file" onChange={handleFileChange} className="form-control mb-2" />
                  <button type="submit" className="btn btn-primary">Upload</button>
                </form>
              </div>
              <div className="tab-pane fade" id="text">
                <h5>Submit Text or Hash</h5>
                <form onSubmit={handleTextSubmit}>
                  <input type="text" value={textInput} onChange={e => setTextInput(e.target.value)} className="form-control mb-2" placeholder="Paste text or hash here" />
                  <button type="submit" className="btn btn-primary">Submit</button>
                </form>
              </div>
              <div className="tab-pane fade" id="url">
                <h5>Submit a URL</h5>
                <form onSubmit={handleUrlSubmit}>
                  <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)} className="form-control mb-2" placeholder="Paste URL here" />
                  <button type="submit" className="btn btn-primary">Submit</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Chart Section */}
      <div className="card mb-4 mt-4">
        <div className="card-header">Analysis Results</div>
        <div className="card-body">
          <div ref={chartRef} style={{ width: '100%', height: 400 }} />
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
