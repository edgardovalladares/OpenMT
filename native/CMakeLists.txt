cmake_minimum_required(VERSION 3.22)
project(OpenMT VERSION 3.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Opciones de optimización
if(MSVC)
    add_compile_options(/W4 /EHsc /O2 /permissive-)
else()
    add_compile_options(-Wall -Wextra -O3)
endif()

include(FetchContent)

# 1. Descargar JUCE (rama develop compatible con Tracktion Engine develop)
message(STATUS "Configurando JUCE...")
FetchContent_Declare(
    juce
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG        develop
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(juce)

# 2. Descargar Tracktion Engine (desarrollo activo para JUCE 8)
message(STATUS "Configurando Tracktion Engine...")
set(TE_ADD_EXAMPLES OFF CACHE BOOL "" FORCE)
FetchContent_Declare(
    tracktion_engine
    GIT_REPOSITORY  https://github.com/Tracktion/tracktion_engine.git
    GIT_TAG         develop
    GIT_SHALLOW     TRUE
    GIT_SUBMODULES  ""
)
FetchContent_MakeAvailable(tracktion_engine)

# 3. Definir la aplicación GUI principal de OpenMT
juce_add_gui_app(OpenMT
    PRODUCT_NAME "OpenMT DAW"
    VERSION "3.0.0"
    BUNDLE_IDENTIFIER "com.openmt.daw"
    COMPANY_NAME "OpenMT"
)

# 4. Archivos fuente del DAW nativo
target_sources(OpenMT PRIVATE
    Source/Main.cpp
    Source/Engine/EngineCore.h
    Source/Engine/EngineCore.cpp
    Source/Engine/SongManager.h
    Source/Engine/SongManager.cpp
    Source/Model/TrackModel.h
    Source/UI/OpenMTLookAndFeel.h
    Source/UI/TopBar.h
    Source/UI/TopBar.cpp
    Source/UI/MixerStrip.h
    Source/UI/MixerStrip.cpp
    Source/UI/SectionsBar.h
    Source/UI/SectionsBar.cpp
    Source/UI/TimelineView.h
    Source/UI/TimelineView.cpp
    Source/UI/MainView.h
    Source/UI/MainView.cpp
)

target_include_directories(OpenMT PRIVATE Source)

# 5. Enlazar módulos de audio y GUI
target_link_libraries(OpenMT
    PRIVATE
        tracktion::tracktion_engine
        tracktion::tracktion_graph
        tracktion::tracktion_core
        juce::juce_core
        juce::juce_events
        juce::juce_graphics
        juce::juce_data_structures
        juce::juce_gui_basics
        juce::juce_gui_extra
        juce::juce_audio_basics
        juce::juce_audio_devices
        juce::juce_audio_formats
        juce::juce_audio_processors
        juce::juce_audio_utils
        juce::juce_dsp
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)
