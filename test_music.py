import requests
import json
import time

def test_music_api(query):
    print(f"--- Testing Music API with query: '{query}' ---")
    
    # Step 1: Search
    # sumitkolhe/jiosaavn-api uses /api/search/songs?query=...
    search_url = f"https://saavn.sumit.co/api/search/songs?query={requests.utils.quote(query)}"
    print(f"1. Searching: {search_url}")
    try:
        r = requests.get(search_url, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        # Structure for this API is data['data']['results']
        results = data.get('data', {}).get('results', [])
        if not results:
            print("FAILED: No results found.")
            return
        
        song = results[0]
        song_id = song.get('id')
        title = song.get('name')
        artist = song.get('artists', {}).get('primary', [{}])[0].get('name', 'Unknown')
        print(f"SUCCESS: Found '{title}' by {artist} (ID: {song_id})")
        
        # Step 2: Extract Download URL (already in search response for this API)
        download_links = song.get('downloadUrl', [])
        # Get highest quality (usually last)
        stream_url = download_links[-1].get('url') if download_links else None
        
        if stream_url:
            print(f"SUCCESS: Stream URL obtained: {stream_url[:50]}...")
            # Step 3: Check stream accessibility
            print("3. Validating Stream Access...")
            try:
                r_stream = requests.head(stream_url, timeout=10, allow_redirects=True)
                if r_stream.status_code < 400:
                    print(f"SUCCESS: Stream is accessible (HTTP {r_stream.status_code})")
                else:
                    print(f"WARNING: Stream head request returned {r_stream.status_code}")
            except Exception as stream_err:
                print(f"ERROR reaching stream: {stream_err}")
        else:
            print("FAILED: Stream URL not found in results.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    test_music_api("Ludovico Einaudi Nuvole Bianche")
    print("\n")
    test_music_api("Taylor Swift Fearless")
