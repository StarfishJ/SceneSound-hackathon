import pandas as pd
from transformers import pipeline

from song import Song

classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

emotion_labels = [
    "happy", "sad", "angry", "fearful", "love", "excitement", "relaxed", "surprised",
    "confused", "regret", "nostalgic", "hopeful", "lonely", "depressed", "anxious",
    "frustrated", "heartbroken", "guilty", "romantic", "passionate", "flirty", "jealous"
]

scene_labels = [
    "party", "beach", "night", "city", "travel", "nature",
    "rain", "sunset", "home", "adventure", "dream", "mountains", "ocean", "festival",
    "urban", "winter", "summer", "farm", "wilderness", "forest", "river", "lake",
    "storm", "snow", "spring", "autumn", "wedding", "funeral", "coffee shop", "bar", "picnic",
    "office", "classroom", "library", "gym", "hiking", "camping", "surfing", "skiing",
    "dancing", "singing", "sports", "celebration"
]

def get_emotion_for_song(lyrics):
    emotion_results = classifier(lyrics, candidate_labels=emotion_labels, multi_label=True)
    return emotion_results['labels'][:3]


def get_scene_for_song(lyrics):
    scene_results = classifier(lyrics, candidate_labels=scene_labels, multi_label=True)
    return scene_results['labels'][:3]


chunks = pd.read_csv('songs.csv' , quotechar='"', chunksize=20)

# store results
songs_with_labels = []

for chunk in chunks:
    songs = []
    for index, row in chunk.iterrows():
        song = Song(
            song=row['song'],
            lyrics=row['lyrics']
        )
        songs.append(song)
    for song in songs:
        song.set_emotion_labels(get_emotion_for_song(song.get_lyrics()))
        song.set_scene_labels(get_scene_for_song(song.get_lyrics()))
        songs_with_labels.append([song.get_song(), song.get_emotion_labels(), song.get_scene_labels()])

df_with_labels = pd.DataFrame(songs_with_labels, columns=["song", "emotion", "scene"])
df_with_labels.to_json('songs_with_labels.json', orient='records', force_ascii=False, indent=4)
