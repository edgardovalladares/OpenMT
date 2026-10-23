#pragma once
#include <juce_gui_basics/juce_gui_basics.h>
#include "../Engine/SongManager.h"
#include "../Engine/EngineCore.h"

namespace OpenMT
{

class SectionsBar : public juce::Component,
                    public juce::ChangeListener
{
public:
    SectionsBar(EngineCore& engineRef, SongManager& songMgrRef);
    ~SectionsBar() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void changeListenerCallback(juce::ChangeBroadcaster* source) override;

private:
    EngineCore& engine;
    SongManager& songManager;
    juce::OwnedArray<juce::TextButton> sectionButtons;
    juce::TextButton autoGenerateButton { "Auto Secciones" };

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(SectionsBar)
};

} // namespace OpenMT
