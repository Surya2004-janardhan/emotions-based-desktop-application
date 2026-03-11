import requests
import json
import time

def test_music_api(query):
    print(f"--- Testing Music API with query: '{query}' ---")
    
    # Step 1: Search
    search_url = f"https://musicapi.x007.workers.dev/search?q={requests.utils.quote(query)}&searchEngine=gaana"
    print(f"1. Searching: {search_url}")
    try:
        r = requests.get(search_url, timeout=10)
        r.raise_for_status()
        data = r.json()
        results = data.get('response', [])
        if not results:
            print("FAILED: No results found.")
            return
        
        song = results[0]
        song_id = song.get('id')
        title = song.get('title')
        print(f"SUCCESS: Found '{title}' (ID: {song_id})")
        
        # Step 2: Fetch stream
        fetch_url = f"https://musicapi.x007.workers.dev/fetch?id={song_id}"
        print(f"2. Fetching Stream: {fetch_url}")
        r_fetch = requests.get(fetch_url, timeout=15)
        r_fetch.raise_for_status()
        fetch_data = r_fetch.json()
        stream_url = fetch_data.get('response')
        
        if stream_url:
            print(f"SUCCESS: Stream URL obtained: {stream_url[:50]}...")
            # Step 3: Check stream accessibility
            print("3. Validating Stream Access...")
            r_stream = requests.head(stream_url, timeout=10)
            if r_stream.status_code == 200:
                print("SUCCESS: Stream is accessible (HTTP 200)")
            else:
                print(f"WARNING: Stream head request returned {r_stream.status_code}")
        else:
            print("FAILED: Stream URL not found in fetch response.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_music_api("Ludovico Einaudi Nuvole Bianche")
    print("\n")
    test_music_api("Taylor Swift Fearless")
