#pragma once
#include <juce_gui_basics/juce_gui_basics.h>
#include "../Engine/EngineCore.h"

namespace OpenMT
{

class MixerStrip : public juce::Component,
                   public juce::Timer
{
public:
    MixerStrip(EngineCore& engineRef, int trackIndexRef, const juce::String& trackName);
    ~MixerStrip() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void timerCallback() override;

    std::function<void(int)> onDeleteTrack;

private:
    EngineCore& engine;
    int trackIndex;
    juce::String name;

    float currentMeterL { 0.0f };
    float currentMeterR { 0.0f };

    juce::Label nameLabel;
    juce::Slider volumeSlider;
    juce::Slider panSlider;
    juce::TextButton muteButton { "M" };
    juce::TextButton soloButton { "S" };
    juce::TextButton deleteButton { "x" };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MixerStrip)
};

} // namespace OpenMT
