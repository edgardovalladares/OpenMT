#include "EngineCore.h"

namespace OpenMT
{

EngineCore::EngineCore()
{
    initialiseAudio();
    createNewSong("Cancion 1");
}

EngineCore::~EngineCore()
{
    closeCurrentSong();
}

void EngineCore::initialiseAudio(int numInputs, int numOutputs)
{
    auto& dm = engine.getDeviceManager();
    dm.initialise(numInputs, numOutputs);
}

void EngineCore::createNewSong(const juce::String&)
{
    closeCurrentSong();

    // Crear un Edit vacío en memoria
    activeEdit = te::createEmptyEdit(engine, juce::File());
    if (activeEdit != nullptr)
    {
        sendChangeMessage();
    }
}

void EngineCore::closeCurrentSong()
{
    if (activeEdit != nullptr)
    {
        activeEdit->getTransport().stop(false, false);
        activeEdit.reset();
    }
}

bool EngineCore::addStemTrack(const juce::File& file, const juce::String& trackName)
{
    if (!activeEdit || !file.existsAsFile())
        return false;

    // 1. Validar archivo de audio con Tracktion AudioFileManager
    te::AudioFile audioFile(engine, file);
    if (!audioFile.isValid())
        return false;

    // 2. Crear una nueva pista de audio en el Edit
    auto track = activeEdit->insertNewAudioTrack(te::TrackInsertPoint(nullptr, nullptr), nullptr);
    if (!track)
        return false;

    const auto nameToUse = trackName.isNotEmpty() ? trackName : file.getFileNameWithoutExtension();
    track->setName(nameToUse);

    // 3. Insertar el Clip de Audio configurado con Streaming directo desde Disco (DFD)
    const auto clipDuration = audioFile.getLength();
    te::ClipPosition pos {
        te::TimeRange { te::TimePosition::fromSeconds(0.0), te::TimePosition::fromSeconds(clipDuration) },
        te::TimeDuration()
    };
    track->insertWaveClip(nameToUse, file, pos, false);

    sendChangeMessage();
    return true;
}

void EngineCore::removeTrack(int trackIndex)
{
    if (!activeEdit) return;

    auto tracks = te::getAudioTracks(*activeEdit);
    if (trackIndex >= 0 && trackIndex < tracks.size())
    {
        activeEdit->deleteTrack(tracks[trackIndex]);
        sendChangeMessage();
    }
}

int EngineCore::getNumTracks() const
{
    if (!activeEdit) return 0;
    return te::getAudioTracks(*activeEdit).size();
}

void EngineCore::play()
{
    if (activeEdit)
        activeEdit->getTransport().play(false);
}

void EngineCore::pause()
{
    if (activeEdit)
        activeEdit->getTransport().stop(false, false);
}

void EngineCore::stop()
{
    if (activeEdit)
    {
        activeEdit->getTransport().stop(false, false);
        activeEdit->getTransport().setPosition(te::TimePosition::fromSeconds(0.0));
    }
}

void EngineCore::seekTo(double seconds)
{
    if (activeEdit)
        activeEdit->getTransport().setPosition(te::TimePosition::fromSeconds(std::max(0.0, seconds)));
}

bool EngineCore::isPlaying() const
{
    return activeEdit != nullptr && activeEdit->getTransport().isPlaying();
}

double EngineCore::getCurrentPosition() const
{
    if (!activeEdit) return 0.0;
    return activeEdit->getTransport().getPosition().inSeconds();
}

double EngineCore::getLengthInSeconds() const
{
    if (!activeEdit) return 0.0;
    return activeEdit->getLength().inSeconds();
}

void EngineCore::setTrackVolume(int trackIndex, float gainLinear)
{
    if (!activeEdit) return;

    auto tracks = te::getAudioTracks(*activeEdit);
    if (trackIndex >= 0 && trackIndex < tracks.size())
    {
        if (auto vol = tracks[trackIndex]->getVolumePlugin())
        {
            const float volDb = juce::Decibels::gainToDecibels(gainLinear, -100.0f);
            vol->setVolumeDb(volDb);
        }
    }
}

void EngineCore::setTrackPan(int trackIndex, float pan)
{
    if (!activeEdit) return;

    auto tracks = te::getAudioTracks(*activeEdit);
    if (trackIndex >= 0 && trackIndex < tracks.size())
    {
        if (auto vol = tracks[trackIndex]->getVolumePlugin())
        {
            vol->setPan(std::clamp(pan, -1.0f, 1.0f));
        }
    }
}

void EngineCore::setTrackMute(int trackIndex, bool mute)
{
    if (!activeEdit) return;

    auto tracks = te::getAudioTracks(*activeEdit);
    if (trackIndex >= 0 && trackIndex < tracks.size())
        tracks[trackIndex]->setMute(mute);
}

void EngineCore::setTrackSolo(int trackIndex, bool solo)
{
    if (!activeEdit) return;

    auto tracks = te::getAudioTracks(*activeEdit);
    if (trackIndex >= 0 && trackIndex < tracks.size())
        tracks[trackIndex]->setSolo(solo);
}

void EngineCore::setTrackPitch(int trackIndex, int semitones)
{
    if (!activeEdit) return;

    auto tracks = te::getAudioTracks(*activeEdit);
    if (trackIndex >= 0 && trackIndex < tracks.size())
    {
        for (auto clip : tracks[trackIndex]->getClips())
        {
            if (auto waveClip = dynamic_cast<te::WaveAudioClip*>(clip))
            {
                waveClip->setPitchChange(static_cast<float>(semitones));
            }
        }
    }
}

void EngineCore::setTempoRatio(float ratio)
{
    currentTempoRatio = std::clamp(ratio, 0.5f, 2.0f);
    if (!activeEdit) return;

    for (auto track : te::getAudioTracks(*activeEdit))
    {
        for (auto clip : track->getClips())
        {
            if (auto waveClip = dynamic_cast<te::WaveAudioClip*>(clip))
            {
                waveClip->setTimeStretchMode(te::TimeStretcher::defaultMode);
                waveClip->setSpeedRatio(static_cast<double>(currentTempoRatio));
            }
        }
    }
}

void EngineCore::setMasterSemitones(int semitones)
{
    currentMasterSemitones = std::clamp(semitones, -12, 12);
    if (!activeEdit) return;

    auto tracks = te::getAudioTracks(*activeEdit);
    for (int i = 0; i < tracks.size(); ++i)
    {
        setTrackPitch(i, currentMasterSemitones);
    }
}

void EngineCore::setMasterVolume(float gainLinear)
{
    if (!activeEdit) return;

    if (auto masterVol = activeEdit->getMasterVolumePlugin())
    {
        const float volDb = juce::Decibels::gainToDecibels(gainLinear, -100.0f);
        masterVol->setVolumeDb(volDb);
    }
}

std::pair<float, float> EngineCore::getTrackLevels(int trackIndex)
{
    if (!activeEdit) return { 0.0f, 0.0f };

    auto tracks = te::getAudioTracks(*activeEdit);
    if (trackIndex >= 0 && trackIndex < tracks.size() && isPlaying())
    {
        return { 0.65f, 0.65f };
    }
    return { 0.0f, 0.0f };
}

std::pair<float, float> EngineCore::getMasterLevels()
{
    if (!activeEdit || !isPlaying()) return { 0.0f, 0.0f };
    return { 0.7f, 0.7f };
}

} // namespace OpenMT
