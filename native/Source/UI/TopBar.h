#pragma once
#include <juce_gui_basics/juce_gui_basics.h>
#include "../Engine/EngineCore.h"
#include "../Engine/SongManager.h"

namespace OpenMT
{

class TopBar : public juce::Component,
               public juce::Timer,
               public juce::ChangeListener
{
public:
    TopBar(EngineCore& engineRef, SongManager& songMgrRef);
    ~TopBar() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void timerCallback() override;
    void changeListenerCallback(juce::ChangeBroadcaster* source) override;

    std::function<void()> onAddStemClicked;

private:
    EngineCore& engine;
    SongManager& songManager;

    juce::TextButton playButton { "Play" };
    juce::TextButton stopButton { "Stop" };
    juce::TextButton addStemButton { "+ Pista" };
    juce::TextButton addSongButton { "+ Canción" };

    juce::ComboBox songSelector;
    juce::Label timeLabel;
    juce::Label pitchLabel;
    juce::Label tempoLabel;

    juce::Slider masterVolumeSlider;
    juce::Slider tempoSlider;
    juce::Slider pitchSlider;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(TopBar)
};

} // namespace OpenMT
