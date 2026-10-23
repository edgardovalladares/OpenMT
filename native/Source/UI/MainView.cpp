#include "MainView.h"

namespace OpenMT
{

MainView::MainView()
    : songManager(engine),
      topBar(engine, songManager),
      sectionsBar(engine, songManager),
      timelineView(engine)
{
    engine.addChangeListener(this);
    songManager.addChangeListener(this);

    addAndMakeVisible(topBar);
    addAndMakeVisible(sectionsBar);
    addAndMakeVisible(timelineView);

    topBar.onAddStemClicked = [this] { openAddStemDialog(); };

    // Contenedor desplazable horizontal para las pistas de mezcla
    mixerViewport.setViewedComponent(&mixerContainer, false);
    mixerViewport.setScrollBarsShown(false, true); // scroll horizontal
    addAndMakeVisible(mixerViewport);

    rebuildMixer();
    setSize(1200, 750);
}

MainView::~MainView()
{
    engine.removeChangeListener(this);
    songManager.removeChangeListener(this);
}

void MainView::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff121316));
}

void MainView::resized()
{
    auto area = getLocalBounds();

    topBar.setBounds(area.removeFromTop(48));
    sectionsBar.setBounds(area.removeFromTop(36));

    // Separar entre Timeline (arriba) y Mezclador (abajo)
    auto mixerArea = area.removeFromBottom(220);
    mixerViewport.setBounds(mixerArea);

    timelineView.setBounds(area);

    // Ajustar ancho del contenedor de pistas
    const int stripWidth = 90;
    const int totalWidth = std::max(getWidth(), engine.getNumTracks() * stripWidth);
    mixerContainer.setBounds(0, 0, totalWidth, mixerViewport.getHeight());

    for (int i = 0; i < mixerStrips.size(); ++i)
    {
        mixerStrips[i]->setBounds(i * stripWidth, 0, stripWidth - 2, mixerContainer.getHeight());
    }
}

void MainView::rebuildMixer()
{
    mixerStrips.clear();
    const int numTracks = engine.getNumTracks();

    for (int i = 0; i < numTracks; ++i)
    {
        juce::String trackName = "Pista " + juce::String(i + 1);
        if (auto edit = engine.getActiveEdit())
        {
            auto tracks = te::getAudioTracks(*edit);
            if (i < tracks.size())
                trackName = tracks[i]->getName();
        }

        auto strip = std::make_unique<MixerStrip>(engine, i, trackName);
        strip->onDeleteTrack = [this](int idx) {
            engine.removeTrack(idx);
        };
        mixerContainer.addAndMakeVisible(strip.get());
        mixerStrips.add(std::move(strip));
    }

    resized();
}

void MainView::changeListenerCallback(juce::ChangeBroadcaster*)
{
    rebuildMixer();
}

bool MainView::isInterestedInFileDrag(const juce::StringArray& files)
{
    for (const auto& f : files)
    {
        if (f.endsWithIgnoreCase(".wav") || f.endsWithIgnoreCase(".mp3") ||
            f.endsWithIgnoreCase(".flac") || f.endsWithIgnoreCase(".ogg") ||
            f.endsWithIgnoreCase(".m4a") || f.endsWithIgnoreCase(".aif"))
            return true;
    }
    return false;
}

void MainView::filesDropped(const juce::StringArray& files, int, int)
{
    for (const auto& path : files)
    {
        juce::File file(path);
        if (file.existsAsFile())
        {
            engine.addStemTrack(file);
        }
    }
}

void MainView::openAddStemDialog()
{
    fileChooser = std::make_unique<juce::FileChooser>(
        "Seleccionar pistas de audio (Stems)...",
        juce::File::getSpecialLocation(juce::File::userMusicDirectory),
        "*.wav;*.mp3;*.flac;*.ogg;*.m4a;*.aif",
        true);

    auto folderChooserFlags = juce::FileBrowserComponent::openMode |
                              juce::FileBrowserComponent::canSelectFiles |
                              juce::FileBrowserComponent::canSelectMultipleItems;

    fileChooser->launchAsync(folderChooserFlags, [this](const juce::FileChooser& chooser) {
        auto results = chooser.getResults();
        for (const auto& file : results)
        {
            if (file.existsAsFile())
            {
                engine.addStemTrack(file);
            }
        }
    });
}

} // namespace OpenMT
