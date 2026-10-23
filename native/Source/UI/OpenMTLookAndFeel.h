#pragma once
#include <juce_gui_basics/juce_gui_basics.h>

namespace OpenMT
{

class OpenMTLookAndFeel : public juce::LookAndFeel_V4
{
public:
    OpenMTLookAndFeel()
    {
        // Paleta inspirada en el tema "live-dark" de OpenMT
        setColour(juce::ResizableWindow::backgroundColourId, juce::Colour(0xff121316));
        setColour(juce::Label::textColourId, juce::Colour(0xfff3f4f6));

        // Botones
        setColour(juce::TextButton::buttonColourId, juce::Colour(0xff23262f));
        setColour(juce::TextButton::buttonOnColourId, juce::Colour(0xff6366f1));
        setColour(juce::TextButton::textColourOffId, juce::Colour(0xffe5e7eb));
        setColour(juce::TextButton::textColourOnId, juce::Colours::white);

        // Sliders (Faders)
        setColour(juce::Slider::thumbColourId, juce::Colour(0xff818cf8));
        setColour(juce::Slider::trackColourId, juce::Colour(0xff374151));
        setColour(juce::Slider::backgroundColourId, juce::Colour(0xff1f2937));
    }

    void drawButtonBackground(juce::Graphics& g, juce::Button& button, const juce::Colour& backgroundColour,
                              bool shouldDrawButtonAsHighlighted, bool shouldDrawButtonAsDown) override
    {
        auto bounds = button.getLocalBounds().toFloat();
        auto cornerSize = 6.0f;

        auto baseColor = backgroundColour;
        if (shouldDrawButtonAsDown)
            baseColor = baseColor.darker(0.2f);
        else if (shouldDrawButtonAsHighlighted)
            baseColor = baseColor.brighter(0.15f);

        g.setColour(baseColor);
        g.fillRoundedRectangle(bounds, cornerSize);

        g.setColour(juce::Colour(0xff374151));
        g.drawRoundedRectangle(bounds.reduced(0.5f), cornerSize, 1.0f);
    }
};

} // namespace OpenMT
