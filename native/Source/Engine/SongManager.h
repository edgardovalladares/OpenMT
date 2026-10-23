#pragma once
#include <juce_core/juce_core.h>
#include <vector>
#include "../Model/TrackModel.h"
#include "EngineCore.h"

namespace OpenMT
{

class SongManager : public juce::ChangeBroadcaster
{
public:
    explicit SongManager(EngineCore& engineRef);
    ~SongManager() override = default;

    // Canciones del Setlist
    int getNumSongs() const { return static_cast<int>(songs.size()); }
    const SongModel& getSong(int index) const { return songs.at(static_cast<size_t>(index)); }
    int getActiveSongIndex() const { return activeIndex; }

    int addSong(const juce::String& name = {});
    void selectSong(int index);
    void removeSong(int index);
    void renameSong(int index, const juce::String& newName);
    void duplicateSong(int index);

    // Secciones de la canción activa
    void addSection(const juce::String& name, double startSeconds, double endSeconds, int colorIndex = 0);
    void removeSection(int sectionIndex);
    const std::vector<SongSection>& getActiveSections() const;

private:
    EngineCore& engine;
    std::vector<SongModel> songs;
    int activeIndex { 0 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(SongManager)
};

} // namespace OpenMT
