#pragma once
#include <juce_gui_basics/juce_gui_basics.h>
#include "../Engine/EngineCore.h"
#include "../Engine/SongManager.h"
#include "TopBar.h"
#include "SectionsBar.h"
#include "TimelineView.h"
#include "MixerStrip.h"

namespace OpenMT
{

class MainView : public juce::Component,
                 public juce::ChangeListener,
                 public juce::FileDragAndDropTarget
{
public:
    MainView();
    ~MainView() override;

    void paint(juce::Graphics& g) override;
    void resized() override;
    void changeListenerCallback(juce::ChangeBroadcaster* source) override;

    // Arrastrar y soltar archivos de audio directamente sobre la ventana
    bool isInterestedInFileDrag(const juce::StringArray& files) override;
    void filesDropped(const juce::StringArray& files, int x, int y) override;

    void openAddStemDialog();

private:
    EngineCore engine;
    SongManager songManager;

    TopBar topBar;
    SectionsBar sectionsBar;
    TimelineView timelineView;

    juce::Viewport mixerViewport;
    juce::Component mixerContainer;
    juce::OwnedArray<MixerStrip> mixerStrips;

    std::unique_ptr<juce::FileChooser> fileChooser;

    void rebuildMixer();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainView)
};

} // namespace OpenMT
