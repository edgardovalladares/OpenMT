#pragma once
#include <juce_gui_basics/juce_gui_basics.h>
#include <tracktion_engine/tracktion_engine.h>
#include "../Engine/EngineCore.h"

namespace OpenMT
{

class TimelineView : public juce::Component,
                     public juce::Timer,
                     public juce::ChangeListener
{
public:
    explicit TimelineView(EngineCore& engineRef);
    ~TimelineView() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void timerCallback() override;
    void mouseDown(const juce::MouseEvent& e) override;
    void changeListenerCallback(juce::ChangeBroadcaster* source) override;

private:
    EngineCore& engine;
    double lastPosition { 0.0 };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(TimelineView)
};

} // namespace OpenMT
