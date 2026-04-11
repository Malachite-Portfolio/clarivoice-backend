import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

let currentSpeakerOn = false;

async function applyAudioMode(speakerOn: boolean) {
  currentSpeakerOn = speakerOn;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: !speakerOn,
  });
}

export async function activateVoiceCallAudio(speakerOn = false) {
  try {
    await applyAudioMode(speakerOn);
  } catch (error) {
    console.error("[call-audio] activate failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function setSpeakerphoneEnabled(speakerOn: boolean) {
  try {
    await applyAudioMode(speakerOn);
  } catch (error) {
    console.error("[call-audio] speaker toggle failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function deactivateVoiceCallAudio() {
  try {
    currentSpeakerOn = false;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    console.error("[call-audio] deactivate failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function getSpeakerphoneState() {
  return currentSpeakerOn;
}
