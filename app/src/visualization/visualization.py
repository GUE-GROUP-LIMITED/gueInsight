import matplotlib.pyplot as plt
import plotly.graph_objects as go
import networkx as nx
from app.src.ingestion.file_ingestion import FileIngestion
from app.src.analysis.file_analysis import analyze_file
from transformers import pipeline
import plotly.express as px
import pandas as pd

# Load a pre-trained model for text summarization
summarizer = pipeline("summarization")

def generate_summary(text):
    """
    Summarize the file analysis results using NLP-based summarization.
    """
    return summarizer(text, max_length=150, min_length=50, do_sample=False)

def visualize_results(analysis_results):
    """
    Visualize the analysis results using charts or graphs.
    """
    # Example: Plotting a bar chart for detected IoCs
    iocs = analysis_results.get("iocs", [])
    labels = [ioc["type"] for ioc in iocs]
    values = [ioc["value"] for ioc in iocs]
    
    plt.bar(labels, values)
    plt.title("Detected IoCs")
    plt.xlabel("IOC Type")
    plt.ylabel("Value")
    plt.show()


def generate_bar_chart(data):
    df = pd.DataFrame(data)
    fig = px.bar(df, x='Category', y='Count', title="Threat Analysis Summary")
    fig.show()

class Visualization:
    """Class for rendering insights from the analysis."""
    
    def __init__(self):
        pass
    
    def plot_malware_family_info(self, malware_family):
        """Plot the identified malware family information."""
        if malware_family == "Unknown":
            print("No malware family identified.")
            return
        fig = go.Figure(data=[go.Bar(
            x=["Malware Family"],
            y=[1],
            text=[malware_family],
            hoverinfo="text"
        )])
        fig.update_layout(title="Identified Malware Family")
        fig.show()

    def plot_encryption_info(self, encryption_type):
        """Display encryption type used by ransomware."""
        if not encryption_type:
            print("No encryption type identified.")
            return
        plt.figure(figsize=(6, 4))
        plt.bar(["Encryption Type"], [1], color='orange')
        plt.title(f"Encryption Method: {encryption_type}")
        plt.show()

      

    def plot_extracted_entities_full(self, emails, bitcoin_addresses, ip_addresses, urls, file_hashes):
        """Create a comprehensive table for all extracted entities."""
        data = {
            "Email Addresses": emails or ["No emails found"],
            "Bitcoin Addresses": bitcoin_addresses or ["No Bitcoin addresses found"],
            "IP Addresses": ip_addresses or ["No IPs found"],
            "URLs": urls or ["No URLs found"],
            "File Hashes": file_hashes or ["No hashes found"]
        }

        fig = go.Figure(data=[go.Table(
            header=dict(
                values=[f"<b>{col}</b>" for col in data.keys()],
                fill_color='paleturquoise',
                align='left'
            ),
            cells=dict(
                values=list(data.values()),
                fill_color='lavender',
                align='left'
            )
        )])
        fig.show()

    def plot_full_network_graph(self, emails, bitcoin_addresses, ip_addresses, urls):
        """Create a comprehensive network graph for all IoCs."""
        if not (emails or bitcoin_addresses or ip_addresses or urls):
            print("Insufficient data to create a network graph.")
            return

        G = nx.Graph()

        # Add nodes
        for email in emails:
            G.add_node(email, type='email')
        for btc in bitcoin_addresses:
            G.add_node(btc, type='bitcoin')
        for ip in ip_addresses:
            G.add_node(ip, type='ip')
        for url in urls:
            G.add_node(url, type='url')

        # Add edges (logic-driven connections)
        for email in emails:
            for btc in bitcoin_addresses:
                G.add_edge(email, btc)
            for url in urls:
                G.add_edge(email, url)

        # Draw the network graph
        pos = nx.spring_layout(G, k=0.7, seed=42)
        plt.figure(figsize=(14, 10))

        nx.draw_networkx_nodes(G, pos, nodelist=emails, node_color='blue', label='Emails')
        nx.draw_networkx_nodes(G, pos, nodelist=bitcoin_addresses, node_color='green', label='Bitcoin Wallets')
        nx.draw_networkx_nodes(G, pos, nodelist=ip_addresses, node_color='orange', label='IPs')
        nx.draw_networkx_nodes(G, pos, nodelist=urls, node_color='purple', label='URLs')
        nx.draw_networkx_edges(G, pos, width=1.0, alpha=0.6, edge_color='gray')
        nx.draw_networkx_labels(G, pos, font_size=9, font_color='black')

        plt.title("Comprehensive Network Graph of IoCs")
        plt.legend()
        plt.axis('off')
        plt.show()

    def plot_risk_score(self, risk_score, max_score=100):
        """Display a gauge chart for the calculated risk score."""
        fig = go.Figure(go.Indicator(
            mode="gauge+number",
            value=risk_score,
            title={"text": "Risk Score"},
            gauge={
                "axis": {"range": [0, max_score]},
                "bar": {"color": "red" if risk_score > 70 else "orange" if risk_score > 40 else "green"},
                "steps": [
                    {"range": [0, 40], "color": "lightgreen"},
                    {"range": [40, 70], "color": "yellow"},
                    {"range": [70, max_score], "color": "red"}
                ]
            }
        ))
        fig.show()

    def plot_file_hash_distribution(self, file_hashes):
        """Display a pie chart for file hash distribution."""
        if not file_hashes:
            print("No file hashes to visualize.")
            return

        hash_types = {"MD5": 0, "SHA1": 0, "SHA256": 0}
        for file_hash in file_hashes:
            if len(file_hash) == 32:
                hash_types["MD5"] += 1
            elif len(file_hash) == 40:
                hash_types["SHA1"] += 1
            elif len(file_hash) == 64:
                hash_types["SHA256"] += 1

        # Plot with Matplotlib
        plt.figure(figsize=(8, 8))
        plt.pie(hash_types.values(), labels=hash_types.keys(), autopct='%1.1f%%', startangle=140, colors=["skyblue", "orange", "green"])
        plt.title("File Hash Type Distribution")
        plt.axis("equal")
        plt.show()


# Main function to integrate with ingestion and analysis layers
if __name__ == "__main__":
    # Step 1: Ingest data
    ingestion = FileIngestion()
    raw_data = ingestion.ingest_file("os.path.join(os.path.abspath(os.path.dirname(__file__)), 'uploads')")  # Replace with your dataset path

    # Step 2: Analyze data
    analysis = analyze_file()
    keywords = analysis.extract_keywords(raw_data)
    emails = analysis.extract_emails(raw_data)
    bitcoin_addresses = analysis.extract_bitcoin_addresses(raw_data)
    ip_addresses = analysis.extract_ips(raw_data)
    urls = analysis.extract_urls(raw_data)
    file_hashes = analysis.extract_file_hashes(raw_data)
    risk_score = analysis.calculate_risk_score(raw_data)

    # Step 3: Visualize data
    visualization = Visualization()

    # Plot keyword frequency
    visualization.plot_keyword_frequency(keywords)

    # Plot extracted entities
    visualization.plot_extracted_entities_full(emails, bitcoin_addresses, ip_addresses, urls, file_hashes)

    # Plot network graph
    visualization.plot_full_network_graph(emails, bitcoin_addresses, ip_addresses, urls)

    # Plot risk score
    visualization.plot_risk_score(risk_score)

    # Plot file hash distribution
    visualization.plot_file_hash_distribution(file_hashes)
