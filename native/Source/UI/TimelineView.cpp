#include "TimelineView.h"

namespace OpenMT
{

TimelineView::TimelineView(EngineCore& engineRef)
    : engine(engineRef)
{
    engine.addChangeListener(this);
    startTimerHz(60); // 60 FPS para movimiento suave del cursor de reproducción
}

TimelineView::~TimelineView()
{
    stopTimer();
    engine.removeChangeListener(this);
}

void TimelineView::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colour(0xff121316));

    const int numTracks = engine.getNumTracks();
    const double totalLength = std::max(1.0, engine.getLengthInSeconds());
    const float trackHeight = 60.0f;

    auto area = getLocalBounds().toFloat();

    // Dibujar pistas
    for (int i = 0; i < numTracks; ++i)
    {
        auto trackArea = area.removeFromTop(trackHeight);

        // Fondo alternado de pista
        g.setColour(i % 2 == 0 ? juce::Colour(0xff181a20) : juce::Colour(0xff15171c));
        g.fillRect(trackArea);

        // Línea divisoria
        g.setColour(juce::Colour(0xff23262f));
        g.drawHorizontalLine(static_cast<int>(trackArea.getBottom()), 0.0f, trackArea.getWidth());

        // Simulación de bloque de audio cargado
        auto clipArea = trackArea.reduced(2.0f, 4.0f);
        g.setColour(juce::Colour(0xff3b82f6).withAlpha(0.35f));
        g.fillRoundedRectangle(clipArea, 4.0f);

        g.setColour(juce::Colour(0xff60a5fa));
        g.drawRoundedRectangle(clipArea, 4.0f, 1.0f);
    }

    // Dibujar Cabezal de Reproducción (Playhead)
    const double curPos = engine.getCurrentPosition();
    const float playheadX = static_cast<float>((curPos / totalLength) * getWidth());

    g.setColour(juce::Colour(0xffef4444)); // Rojo brillante
    g.drawVerticalLine(static_cast<int>(playheadX), 0.0f, static_cast<float>(getHeight()));

    // Indicador en triángulo en la parte superior
    juce::Path p;
    p.addTriangle(playheadX - 6.0f, 0.0f, playheadX + 6.0f, 0.0f, playheadX, 10.0f);
    g.fillPath(p);
}

void TimelineView::resized()
{
}

void TimelineView::timerCallback()
{
    const double curPos = engine.getCurrentPosition();
    if (std::abs(curPos - lastPosition) > 0.001 || engine.isPlaying())
    {
        lastPosition = curPos;
        repaint();
    }
}

void TimelineView::mouseDown(const juce::MouseEvent& e)
{
    const double totalLength = std::max(1.0, engine.getLengthInSeconds());
    const double targetSec = (static_cast<double>(e.x) / getWidth()) * totalLength;
    engine.seekTo(targetSec);
    repaint();
}

void TimelineView::changeListenerCallback(juce::ChangeBroadcaster*)
{
    repaint();
}

} // namespace OpenMT
