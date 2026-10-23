#include "SongManager.h"

namespace OpenMT
{

SongManager::SongManager(EngineCore& engineRef)
    : engine(engineRef)
{
    addSong("Canción 1");
}

int SongManager::addSong(const juce::String& name)
{
    SongModel newSong;
    newSong.id = juce::Uuid().toString();
    newSong.name = name.isNotEmpty() ? name : "Canción " + juce::String(songs.size() + 1);

    songs.push_back(std::move(newSong));
    const int newIndex = static_cast<int>(songs.size() - 1);

    if (songs.size() == 1)
    {
        selectSong(0);
    }

    sendChangeMessage();
    return newIndex;
}

void SongManager::selectSong(int index)
{
    if (index < 0 || index >= static_cast<int>(songs.size()))
        return;

    activeIndex = index;
    const auto& currentSong = songs[static_cast<size_t>(activeIndex)];

    // Crear / cambiar el Edit activo en Tracktion Engine
    engine.createNewSong(currentSong.name);

    // Cargar los stems de esta canción mediante streaming directo desde disco
    for (const auto& tr : currentSong.tracks)
    {
        if (tr.audioFile.existsAsFile())
        {
            engine.addStemTrack(tr.audioFile, tr.name);
        }
    }

    // Aplicar tempo y tono
    engine.setTempoRatio(currentSong.tempoRatio);
    engine.setMasterSemitones(currentSong.masterSemitones);
    engine.setMasterVolume(currentSong.masterVolumeGain);

    sendChangeMessage();
}

void SongManager::removeSong(int index)
{
    if (songs.size() <= 1 || index < 0 || index >= static_cast<int>(songs.size()))
        return;

    songs.erase(songs.begin() + index);
    if (activeIndex >= static_cast<int>(songs.size()))
        activeIndex = static_cast<int>(songs.size()) - 1;

    selectSong(activeIndex);
    sendChangeMessage();
}

void SongManager::renameSong(int index, const juce::String& newName)
{
    if (index >= 0 && index < static_cast<int>(songs.size()))
    {
        songs[static_cast<size_t>(index)].name = newName;
        sendChangeMessage();
    }
}

void SongManager::duplicateSong(int index)
{
    if (index < 0 || index >= static_cast<int>(songs.size()))
        return;

    SongModel copy = songs[static_cast<size_t>(index)];
    copy.id = juce::Uuid().toString();
    copy.name += " (Copia)";

    songs.push_back(std::move(copy));
    sendChangeMessage();
}

void SongManager::addSection(const juce::String& name, double startSeconds, double endSeconds, int colorIndex)
{
    if (activeIndex < 0 || activeIndex >= static_cast<int>(songs.size()))
        return;

    SongSection sec;
    sec.id = juce::Uuid().toString();
    sec.name = name;
    sec.startSeconds = startSeconds;
    sec.endSeconds = endSeconds;
    sec.colorIndex = colorIndex;

    songs[static_cast<size_t>(activeIndex)].sections.push_back(sec);
    sendChangeMessage();
}

void SongManager::removeSection(int sectionIndex)
{
    if (activeIndex < 0 || activeIndex >= static_cast<int>(songs.size()))
        return;

    auto& secs = songs[static_cast<size_t>(activeIndex)].sections;
    if (sectionIndex >= 0 && sectionIndex < static_cast<int>(secs.size()))
    {
        secs.erase(secs.begin() + sectionIndex);
        sendChangeMessage();
    }
}

const std::vector<SongSection>& SongManager::getActiveSections() const
{
    static const std::vector<SongSection> empty;
    if (activeIndex >= 0 && activeIndex < static_cast<int>(songs.size()))
        return songs[static_cast<size_t>(activeIndex)].sections;
    return empty;
}

} // namespace OpenMT
