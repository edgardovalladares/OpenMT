#pragma once
#include <juce_core/juce_core.h>
#include <juce_graphics/juce_graphics.h>
#include <vector>

namespace OpenMT
{

struct SongSection
{
    juce::String id;
    juce::String name;
    double startSeconds { 0.0 };
    double endSeconds { 0.0 };
    int colorIndex { 0 };

    [[nodiscard]] double getDuration() const noexcept { return endSeconds - startSeconds; }
};

struct TrackModel
{
    juce::String id;
    juce::String name;
    juce::File audioFile;
    int colorIndex { 0 };

    float volumeGain { 1.0f }; // 0.0 a 1.0 (o dB)
    float pan { 0.0f };        // -1.0 (izq) a 1.0 (der)
    bool mute { false };
    bool solo { false };

    int semitones { 0 };       // -12 a +12
    bool pitchLocked { false }; // para batería/claqueta

    double trimStart { 0.0 };
    double trimEnd { 0.0 };
    double fadeIn { 0.0 };
    double fadeOut { 0.0 };
    double duration { 0.0 };
};

struct SongModel
{
    juce::String id;
    juce::String name;
    std::vector<TrackModel> tracks;
    std::vector<SongSection> sections;
    float tempoRatio { 1.0f };     // 0.5 a 2.0
    int masterSemitones { 0 };      // -12 a +12
    float masterVolumeGain { 1.0f };
};

} // namespace OpenMT
