#include "TopBar.h"

namespace OpenMT
{

TopBar::TopBar(EngineCore& engineRef, SongManager& songMgrRef)
    : engine(engineRef), songManager(songMgrRef)
{
    engine.addChangeListener(this);
    songManager.addChangeListener(this);

    // Botones de transporte
    playButton.setColour(juce::TextButton::buttonColourId, juce::Colour(0xff10b981)); // Verde
    playButton.onClick = [this] {
        if (engine.isPlaying())
            engine.pause();
        else
            engine.play();
    };
    addAndMakeVisible(playButton);

    stopButton.onClick = [this] { engine.stop(); };
    addAndMakeVisible(stopButton);

    // Selector de Canciones
    songSelector.onChange = [this] {
        const int selected = songSelector.getSelectedId() - 1;
        if (selected >= 0 && selected != songManager.getActiveSongIndex())
            songManager.selectSong(selected);
    };
    addAndMakeVisible(songSelector);

    addSongButton.onClick = [this] {
        songManager.addSong();
    };
    addAndMakeVisible(addSongButton);

    addStemButton.onClick = [this] {
        if (onAddStemClicked) onAddStemClicked();
    };
    addAndMakeVisible(addStemButton);

    // Contador de tiempo
    timeLabel.setText("00:00.0", juce::dontSendNotification);
    timeLabel.setFont(juce::FontOptions(18.0f, juce::Font::bold));
    timeLabel.setColour(juce::Label::textColourId, juce::Colour(0xff10b981));
    timeLabel.setJustificationType(juce::Justification::centred);
    addAndMakeVisible(timeLabel);

    // Sliders de Tempo y Pitch
    tempoSlider.setRange(0.5, 2.0, 0.01);
    tempoSlider.setValue(1.0);
    tempoSlider.setSliderStyle(juce::Slider::LinearHorizontal);
    tempoSlider.setTextBoxStyle(juce::Slider::TextBoxRight, false, 50, 20);
    tempoSlider.onValueChange = [this] {
        engine.setTempoRatio(static_cast<float>(tempoSlider.getValue()));
    };
    addAndMakeVisible(tempoSlider);

    pitchSlider.setRange(-12, 12, 1);
    pitchSlider.setValue(0);
    pitchSlider.setSliderStyle(juce::Slider::LinearHorizontal);
    pitchSlider.setTextBoxStyle(juce::Slider::TextBoxRight, false, 40, 20);
    pitchSlider.onValueChange = [this] {
        engine.setMasterSemitones(static_cast<int>(pitchSlider.getValue()));
    };
    addAndMakeVisible(pitchSlider);

    // Master Volume
    masterVolumeSlider.setRange(0.0, 1.25, 0.01);
    masterVolumeSlider.setValue(1.0);
    masterVolumeSlider.setSliderStyle(juce::Slider::LinearHorizontal);
    masterVolumeSlider.setTextBoxStyle(juce::Slider::NoTextBox, false, 0, 0);
    masterVolumeSlider.onValueChange = [this] {
        engine.setMasterVolume(static_cast<float>(masterVolumeSlider.getValue()));
    };
    addAndMakeVisible(masterVolumeSlider);

    changeListenerCallback(nullptr);
    startTimerHz(30); // 30 FPS para actualizar reloj de tiempo
}

TopBar::~TopBar()
{
    stopTimer();
    engine.removeChangeListener(this);
    songManager.removeChangeListener(this);
}

void TopBar::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff16181d));

    g.setColour(juce::Colour(0xff2d3139));
    g.drawHorizontalLine(getHeight() - 1, 0.0f, static_cast<float>(getWidth()));

    g.setColour(juce::Colours::white);
    g.setFont(juce::FontOptions(15.0f, juce::Font::bold));
    g.drawText("OpenMT", 16, 0, 70, getHeight(), juce::Justification::centredLeft);

    g.setColour(juce::Colour(0xff9ca3af));
    g.setFont(12.0f);
    g.drawText("Tempo:", tempoSlider.getX() - 48, tempoSlider.getY(), 45, tempoSlider.getHeight(), juce::Justification::centredRight);
    g.drawText("Tono:", pitchSlider.getX() - 40, pitchSlider.getY(), 38, pitchSlider.getHeight(), juce::Justification::centredRight);
    g.drawText("Master:", masterVolumeSlider.getX() - 50, masterVolumeSlider.getY(), 48, masterVolumeSlider.getHeight(), juce::Justification::centredRight);
}

void TopBar::resized()
{
    auto area = getLocalBounds().reduced(8, 6);
    area.removeFromLeft(80); // Espacio para el logo

    playButton.setBounds(area.removeFromLeft(60));
    area.removeFromLeft(6);
    stopButton.setBounds(area.removeFromLeft(60));
    area.removeFromLeft(12);

    timeLabel.setBounds(area.removeFromLeft(90));
    area.removeFromLeft(16);

    songSelector.setBounds(area.removeFromLeft(140));
    area.removeFromLeft(6);
    addSongButton.setBounds(area.removeFromLeft(80));
    area.removeFromLeft(16);

    addStemButton.setBounds(area.removeFromLeft(75));
    area.removeFromLeft(20);

    // Controles de tempo y tono a la derecha
    auto rightArea = area.removeFromRight(150);
    masterVolumeSlider.setBounds(rightArea);
    area.removeFromRight(16);

    auto pitchArea = area.removeFromRight(120);
    pitchSlider.setBounds(pitchArea);
    area.removeFromRight(16);

    auto tempoArea = area.removeFromRight(140);
    tempoSlider.setBounds(tempoArea);
}

void TopBar::timerCallback()
{
    // Actualizar texto del botón de reproducción
    playButton.setButtonText(engine.isPlaying() ? "Pause" : "Play");
    playButton.setColour(juce::TextButton::buttonColourId, engine.isPlaying() ? juce::Colour(0xfff59e0b) : juce::Colour(0xff10b981));

    // Formatear segundos a MM:SS.d
    const double pos = engine.getCurrentPosition();
    const int minutes = static_cast<int>(pos) / 60;
    const int seconds = static_cast<int>(pos) % 60;
    const int tenths = static_cast<int>(pos * 10) % 10;
    timeLabel.setText(juce::String::formatted("%02d:%02d.%d", minutes, seconds, tenths), juce::dontSendNotification);
}

void TopBar::changeListenerCallback(juce::ChangeBroadcaster*)
{
    songSelector.clear(juce::dontSendNotification);
    for (int i = 0; i < songManager.getNumSongs(); ++i)
    {
        songSelector.addItem(songManager.getSong(i).name, i + 1);
    }
    songSelector.setSelectedId(songManager.getActiveSongIndex() + 1, juce::dontSendNotification);
}

} // namespace OpenMT
