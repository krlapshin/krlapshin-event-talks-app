import os
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Simple in-memory cache
FEED_CACHE = {
    'data': None,
    'last_updated': 0
}
CACHE_DURATION_SECONDS = 300  # 5 minutes cache

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    """Fetches the Google Cloud BigQuery release notes XML feed and parses it into JSON."""
    req = urllib.request.Request(FEED_URL, headers={'User-Agent': 'Mozilla/5.0'})
    
    with urllib.request.urlopen(req, timeout=10) as response:
        xml_data = response.read()
        
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    entries = root.findall('atom:entry', ns)
    
    parsed_updates = []
    
    for entry in entries:
        title = entry.find('atom:title', ns)
        title_text = title.text if title is not None else "" # e.g. "June 15, 2026"
        
        updated = entry.find('atom:updated', ns)
        updated_text = updated.text if updated is not None else ""
        
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        link = link_elem.attrib.get('href') if link_elem is not None else ""
        
        content_elem = entry.find('atom:content', ns)
        content = content_elem.text if content_elem is not None else ""
        
        if not content:
            continue
            
        # Extract date string YYYY-MM-DD from updated tag
        date_match = re.search(r'^\d{4}-\d{2}-\d{2}', updated_text)
        date_str = date_match.group(0) if date_match else title_text
        
        # Regex to split content by <h3> headers
        # Formats: <h3>Feature</h3> <p>...</p> <h3>Issue</h3> <p>...</p>
        pattern = re.compile(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', re.DOTALL)
        updates = pattern.findall(content)
        
        # Fallback if no <h3> tags found
        if not updates:
            # Clean up entire content for text version
            plain_text = re.sub(r'<[^>]+>', '', content)
            plain_text = re.sub(r'\s+', ' ', plain_text).strip()
            parsed_updates.append({
                'id': f"{date_str}_0",
                'date': date_str,
                'date_formatted': title_text,
                'type': 'Update',
                'content_html': content,
                'content_text': plain_text,
                'link': link
            })
            continue
            
        for idx, (utype, ucontent) in enumerate(updates):
            type_clean = utype.strip()
            content_clean = ucontent.strip()
            
            # Create a plain text version for search and tweeting
            plain_text = re.sub(r'<[^>]+>', '', content_clean)
            plain_text = re.sub(r'\s+', ' ', plain_text).strip()
            
            update_id = f"{date_str}_{idx}"
            
            # Determine specific anchor from link if available
            anchor_link = link
            if link and not link.endswith(f"#{title_text.replace(' ', '_')}"):
                # Clean title for anchor tag format if needed
                clean_anchor = title_text.replace(' ', '_').replace(',', '')
                anchor_link = f"{link.split('#')[0]}#{clean_anchor}"
            
            parsed_updates.append({
                'id': update_id,
                'date': date_str,
                'date_formatted': title_text,
                'type': type_clean,
                'content_html': content_clean,
                'content_text': plain_text,
                'link': anchor_link
            })
            
    return parsed_updates

@app.route('/')
def index():
    """Renders the dashboard UI."""
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    """API endpoint to get release notes. Supports ?refresh=true query param."""
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Check if cache is expired or force refresh is requested
    if (FEED_CACHE['data'] is None or 
        force_refresh or 
        (current_time - FEED_CACHE['last_updated'] > CACHE_DURATION_SECONDS)):
        
        try:
            updates = fetch_and_parse_feed()
            FEED_CACHE['data'] = updates
            FEED_CACHE['last_updated'] = current_time
            return jsonify({
                'success': True,
                'source': 'network',
                'last_updated': current_time,
                'count': len(updates),
                'updates': updates
            })
        except Exception as e:
            # If fetch fails but we have cached data, return cache with a warning
            if FEED_CACHE['data'] is not None:
                return jsonify({
                    'success': True,
                    'source': 'cache_fallback_error',
                    'error': str(e),
                    'last_updated': FEED_CACHE['last_updated'],
                    'count': len(FEED_CACHE['data']),
                    'updates': FEED_CACHE['data']
                })
            else:
                return jsonify({
                    'success': False,
                    'error': f"Failed to fetch release notes: {str(e)}"
                }), 500
    else:
        return jsonify({
            'success': True,
            'source': 'cache',
            'last_updated': FEED_CACHE['last_updated'],
            'count': len(FEED_CACHE['data']),
            'updates': FEED_CACHE['data']
        })

if __name__ == '__main__':
    # Default Flask port is 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
