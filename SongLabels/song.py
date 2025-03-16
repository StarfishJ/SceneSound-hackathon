class Song:
    def __init__(self, song,lyrics, emotion_labels=None, scene_labels=None):
        self.song = song
        self.lyrics = lyrics
        self.emotion_labels = emotion_labels
        self.scene_labels = scene_labels

    def set_emotion_labels(self, emotion_labels):
        self.emotion_labels = emotion_labels

    def set_scene_labels(self, scene_labels):
        self.scene_labels = scene_labels

    def get_song(self):
        return self.song
    def get_lyrics(self):
        return self.lyrics
    def get_emotion_labels(self):
        return self.emotion_labels
    def get_scene_labels(self):
        return self.scene_labels

    def __str__(self):
        return f"Song({self.song}, {self.lyrics}, {self.emotion_labels}, {self.scene_labels})"
