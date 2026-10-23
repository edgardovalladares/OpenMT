#pragma once
#include <juce_audio_devices/juce_audio_devices.h>
#include <juce_audio_utils/juce_audio_utils.h>
#include <tracktion_engine/tracktion_engine.h>
#include "../Model/TrackModel.h"

namespace te = tracktion;

namespace OpenMT
{

class EngineCore : public juce::ChangeBroadcaster
{
public:
    EngineCore();
    ~EngineCore() override;

    // Inicialización del dispositivo de audio y drivers (ASIO/WASAPI)
    void initialiseAudio(int numInputs = 2, int numOutputs = 2);
    te::Engine& getEngine() { return engine; }
    te::Edit* getActiveEdit() { return activeEdit.get(); }

    // Gestión del proyecto / canción activa
    void createNewSong(const juce::String& songName = "Nueva Cancion");
    void closeCurrentSong();

    // Pistas y Audio (Stems)
    bool addStemTrack(const juce::File& file, const juce::String& trackName = {});
    void removeTrack(int trackIndex);
    int getNumTracks() const;

    // Transporte (Play, Pause, Stop, Seek)
    void play();
    void pause();
    void stop();
    void seekTo(double seconds);
    [[nodiscard]] bool isPlaying() const;
    [[nodiscard]] double getCurrentPosition() const;
    [[nodiscard]] double getLengthInSeconds() const;

    // Mezcla y controles por pista
    void setTrackVolume(int trackIndex, float gainLinear);
    void setTrackPan(int trackIndex, float pan);
    void setTrackMute(int trackIndex, bool mute);
    void setTrackSolo(int trackIndex, bool solo);
    void setTrackPitch(int trackIndex, int semitones);

    // Ajustes globales de la canción
    void setTempoRatio(float ratio); // 0.5x - 2.0x
    void setMasterSemitones(int semitones); // -12 a +12
    void setMasterVolume(float gainLinear);

    // Medición de niveles (VU meters)
    std::pair<float, float> getTrackLevels(int trackIndex);
    std::pair<float, float> getMasterLevels();

private:
    te::Engine engine { "OpenMT_Native" };
    std::unique_ptr<te::Edit> activeEdit;
    float currentTempoRatio { 1.0f };
    int currentMasterSemitones { 0 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(EngineCore)
};

} // namespace OpenMT
