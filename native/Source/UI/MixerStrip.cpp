#include "MixerStrip.h"

namespace OpenMT
{

MixerStrip::MixerStrip(EngineCore& engineRef, int trackIndexRef, const juce::String& trackName)
    : engine(engineRef), trackIndex(trackIndexRef), name(trackName)
{
    nameLabel.setText(name, juce::dontSendNotification);
    nameLabel.setFont(juce::FontOptions(12.0f, juce::Font::bold));
    nameLabel.setJustificationType(juce::Justification::centred);
    nameLabel.setColour(juce::Label::textColourId, juce::Colours::white);
    addAndMakeVisible(nameLabel);

    // Fader de volumen vertical
    volumeSlider.setSliderStyle(juce::Slider::LinearVertical);
    volumeSlider.setRange(0.0, 1.25, 0.01);
    volumeSlider.setValue(1.0);
    volumeSlider.setTextBoxStyle(juce::Slider::NoTextBox, false, 0, 0);
    volumeSlider.onValueChange = [this] {
        engine.setTrackVolume(trackIndex, static_cast<float>(volumeSlider.getValue()));
    };
    addAndMakeVisible(volumeSlider);

    // Pan
    panSlider.setSliderStyle(juce::Slider::LinearHorizontal);
    panSlider.setRange(-1.0, 1.0, 0.02);
    panSlider.setValue(0.0);
    panSlider.setTextBoxStyle(juce::Slider::NoTextBox, false, 0, 0);
    panSlider.onValueChange = [this] {
        engine.setTrackPan(trackIndex, static_cast<float>(panSlider.getValue()));
    };
    addAndMakeVisible(panSlider);

    // Mute y Solo
    muteButton.setClickingTogglesState(true);
    muteButton.onClick = [this] {
        const bool isMuted = muteButton.getToggleState();
        muteButton.setColour(juce::TextButton::buttonColourId, isMuted ? juce::Colour(0xffef4444) : juce::Colour(0xff23262f));
        engine.setTrackMute(trackIndex, isMuted);
    };
    addAndMakeVisible(muteButton);

    soloButton.setClickingTogglesState(true);
    soloButton.onClick = [this] {
        const bool isSolo = soloButton.getToggleState();
        soloButton.setColour(juce::TextButton::buttonColourId, isSolo ? juce::Colour(0xffeab308) : juce::Colour(0xff23262f));
        engine.setTrackSolo(trackIndex, isSolo);
    };
    addAndMakeVisible(soloButton);

    deleteButton.onClick = [this] {
        if (onDeleteTrack) onDeleteTrack(trackIndex);
    };
    addAndMakeVisible(deleteButton);

    startTimerHz(30); // 30 FPS para medidor de señal
}

MixerStrip::~MixerStrip()
{
    stopTimer();
}

void MixerStrip::paint(juce::Graphics& g)
{
    // Fondo de la tira de canal
    g.fillAll(juce::Colour(0xff181a20));

    // Borde
    g.setColour(juce::Colour(0xff2c303a));
    g.drawRect(getLocalBounds(), 1);

    // Dibujar medidor VU vertical junto al fader
    auto meterArea = volumeSlider.getBounds().removeFromRight(6).reduced(0, 4);
    g.setColour(juce::Colour(0xff111215));
    g.fillRect(meterArea);

    const float level = std::max(currentMeterL, currentMeterR);
    const int meterHeight = static_cast<int>(meterArea.getHeight() * std::clamp(level, 0.0f, 1.0f));

    if (meterHeight > 0)
    {
        auto activeMeter = meterArea.removeFromBottom(meterHeight);
        g.setColour(level > 0.95f ? juce::Colour(0xffef4444) : juce::Colour(0xff10b981));
        g.fillRect(activeMeter);
    }
}

void MixerStrip::resized()
{
    auto area = getLocalBounds().reduced(4);

    auto topArea = area.removeFromTop(20);
    deleteButton.setBounds(topArea.removeFromRight(20));
    nameLabel.setBounds(topArea);

    panSlider.setBounds(area.removeFromTop(18));

    auto buttonArea = area.removeFromTop(22);
    muteButton.setBounds(buttonArea.removeFromLeft(buttonArea.getWidth() / 2 - 2));
    soloButton.setBounds(buttonArea.removeFromRight(buttonArea.getWidth() - 2));

    area.removeFromTop(4);
    volumeSlider.setBounds(area);
}

void MixerStrip::timerCallback()
{
    auto levels = engine.getTrackLevels(trackIndex);
    currentMeterL = levels.first;
    currentMeterR = levels.second;
    repaint();
}

} // namespace OpenMT
