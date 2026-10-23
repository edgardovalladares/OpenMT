#include <juce_gui_basics/juce_gui_basics.h>
#include "UI/OpenMTLookAndFeel.h"
#include "UI/MainView.h"

namespace OpenMT
{

class MainWindow : public juce::DocumentWindow
{
public:
    explicit MainWindow(const juce::String& name)
        : DocumentWindow(name,
                         juce::Colour(0xff121316),
                         DocumentWindow::allButtons)
    {
        setUsingNativeTitleBar(true);
        setContentOwned(new MainView(), true);

       #if JUCE_IOS || JUCE_ANDROID
        setFullScreen(true);
       #else
        setResizable(true, true);
        setResizeLimits(800, 500, 3840, 2160);
        centreWithSize(getWidth(), getHeight());
       #endif

        setVisible(true);
    }

    void closeButtonPressed() override
    {
        juce::JUCEApplication::getInstance()->systemRequestedQuit();
    }

private:
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainWindow)
};

class OpenMTApplication : public juce::JUCEApplication
{
public:
    OpenMTApplication() = default;

    const juce::String getApplicationName() override       { return "OpenMT DAW"; }
    const juce::String getApplicationVersion() override    { return "3.0.0"; }
    bool moreThanOneInstanceAllowed() override             { return true; }

    void initialise(const juce::String&) override
    {
        juce::LookAndFeel::setDefaultLookAndFeel(&lookAndFeel);
        mainWindow = std::make_unique<MainWindow>(getApplicationName());
    }

    void shutdown() override
    {
        mainWindow.reset();
        juce::LookAndFeel::setDefaultLookAndFeel(nullptr);
    }

    void systemRequestedQuit() override
    {
        quit();
    }

private:
    OpenMTLookAndFeel lookAndFeel;
    std::unique_ptr<MainWindow> mainWindow;
};

} // namespace OpenMT

START_JUCE_APPLICATION(OpenMT::OpenMTApplication)
