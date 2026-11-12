"""Exercise the real decoder without loading a model or using recordings."""

import io
import unittest
import wave

import numpy as np
from faster_whisper.audio import decode_audio


class AudioDecodingTests(unittest.TestCase):
    def test_decodes_pcm_wav_stream_with_installed_pyav(self):
        audio = io.BytesIO()
        with wave.open(audio, "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes((1000).to_bytes(2, "little", signed=True) * 1600)
        audio.seek(0)

        samples = decode_audio(audio, sampling_rate=16000)

        self.assertEqual(samples.shape, (1600,))
        self.assertEqual(samples.dtype, np.float32)
        np.testing.assert_allclose(samples, 1000 / 32768, atol=1e-6)


if __name__ == "__main__":
    unittest.main()
