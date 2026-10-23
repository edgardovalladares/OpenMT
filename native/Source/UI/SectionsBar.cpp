#include "SectionsBar.h"

namespace OpenMT
{

static const juce::Colour sectionColours[] = {
    juce::Colour(0xff3b82f6), // Azul
    juce::Colour(0xff10b981), // Verde
    juce::Colour(0xfff59e0b), // Ámbar
    juce::Colour(0xffec4899), // Rosa
    juce::Colour(0xff8b5cf6), // Púrpura
    juce::Colour(0xff06b6d4), // Cyan
    juce::Colour(0xfff97316), // Naranja
    juce::Colour(0xff6366f1)  // Indigo
};

SectionsBar::SectionsBar(EngineCore& engineRef, SongManager& songMgrRef)
    : engine(engineRef), songManager(songMgrRef)
{
    songManager.addChangeListener(this);

    autoGenerateButton.onClick = [this] {
        const double duration = engine.getLengthInSeconds();
        if (duration <= 5.0) return;

        // Plantilla automática estándar
        const double partLen = duration / 6.0;
        songManager.addSection("Intro", 0.0, partLen, 0);
        songManager.addSection("Verso 1", partLen, partLen * 2, 1);
        songManager.addSection("Coro 1", partLen * 2, partLen * 3, 2);
        songManager.addSection("Verso 2", partLen * 3, partLen * 4, 1);
        songManager.addSection("Coro 2", partLen * 4, partLen * 5, 2);
        songManager.addSection("Outro", partLen * 5, duration, 4);
    };
    addAndMakeVisible(autoGenerateButton);

    changeListenerCallback(nullptr);
}

SectionsBar::~SectionsBar()
{
    songManager.removeChangeListener(this);
}

void SectionsBar::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff14161b));
    g.setColour(juce::Colour(0xff23262f));
    g.drawHorizontalLine(getHeight() - 1, 0.0f, static_cast<float>(getWidth()));
}

void SectionsBar::resized()
{
    auto area = getLocalBounds().reduced(6, 4);
    autoGenerateButton.setBounds(area.removeFromLeft(120));
    area.removeFromLeft(12);

    const auto& sections = songManager.getActiveSections();
    if (sections.empty() || sectionButtons.size() != static_cast<int>(sections.size()))
        return;

    const int btnWidth = std::min(110, area.getWidth() / std::max(1, static_cast<int>(sections.size())));
    for (int i = 0; i < sectionButtons.size(); ++i)
    {
        sectionButtons[i]->setBounds(area.removeFromLeft(btnWidth));
        area.removeFromLeft(4);
    }
}

void SectionsBar::changeListenerCallback(juce::ChangeBroadcaster*)
{
    sectionButtons.clear();
    const auto& sections = songManager.getActiveSections();

    for (size_t i = 0; i < sections.size(); ++i)
    {
        const auto& sec = sections[i];
        auto btn = std::make_unique<juce::TextButton>(sec.name);
        btn->setColour(juce::TextButton::buttonColourId, sectionColours[sec.colorIndex % 8].withAlpha(0.7f));
        btn->onClick = [this, startSec = sec.startSeconds] {
            engine.seekTo(startSec);
        };
        addAndMakeVisible(btn.get());
        sectionButtons.add(std::move(btn));
    }
    resized();
}

} // namespace OpenMT
