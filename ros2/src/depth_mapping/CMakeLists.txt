cmake_minimum_required(VERSION 3.8)
project(depth_mapping)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# ---------- ROS dependencies ----------
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(visualization_msgs REQUIRED)
find_package(cv_bridge REQUIRED)
find_package(message_filters REQUIRED)
find_package(OpenCV REQUIRED)
find_package(rosidl_default_generators REQUIRED)

# ---------- ONNX Runtime (C++ API) ----------
# Tries cmake package config first; falls back to manual find_library / find_path.
find_package(onnxruntime QUIET)
if(NOT onnxruntime_FOUND)
  find_library(ONNXRUNTIME_LIB NAMES onnxruntime
    PATHS /usr/local/lib /usr/lib /opt/conda/lib)
  find_path(ONNXRUNTIME_INCLUDE_DIR NAMES onnxruntime_cxx_api.h
    PATHS /usr/local/include /usr/include
          /opt/conda/include
          /usr/local/include/onnxruntime
          /usr/include/onnxruntime
          /opt/conda/include/onnxruntime)
  if(NOT (ONNXRUNTIME_LIB AND ONNXRUNTIME_INCLUDE_DIR))
    message(FATAL_ERROR
      "onnxruntime C++ not found.\n"
      "Install via:\n"
      "  conda install -c conda-forge onnxruntime\n"
      "or download a release from\n"
      "  https://github.com/microsoft/onnxruntime/releases\n"
      "and set CMAKE_PREFIX_PATH accordingly.")
  endif()
  message(STATUS "onnxruntime (manual): lib=${ONNXRUNTIME_LIB}  inc=${ONNXRUNTIME_INCLUDE_DIR}")
endif()

# ---------- Custom messages ----------
rosidl_generate_types(${PROJECT_NAME}
  "msg/SpatialDetection.msg"
  "msg/SpatialDetectionArray.msg"
  DEPENDENCIES geometry_msgs std_msgs
)

# ---------- Node executable ----------
add_executable(spatial_recognition_node
  src/spatial_recognition_node.cpp
)

ament_target_dependencies(spatial_recognition_node
  rclcpp
  sensor_msgs
  geometry_msgs
  std_msgs
  visualization_msgs
  cv_bridge
  message_filters
  OpenCV
)

# Link generated messages
target_link_libraries(spatial_recognition_node ${PROJECT_NAME})

# Link ONNX Runtime
if(onnxruntime_FOUND)
  target_link_libraries(spatial_recognition_node onnxruntime)
else()
  target_include_directories(spatial_recognition_node PRIVATE ${ONNXRUNTIME_INCLUDE_DIR})
  target_link_libraries(spatial_recognition_node ${ONNXRUNTIME_LIB})
endif()

# ---------- Install ----------
install(TARGETS spatial_recognition_node
  DESTINATION lib/${PROJECT_NAME}
)

install(DIRECTORY launch/
  DESTINATION share/${PROJECT_NAME}/launch
)

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  set(ament_cmake_copyright_FOUND TRUE)
  set(ament_cmake_cpplint_FOUND TRUE)
  ament_lint_auto_find_test_dependencies()
endif()

ament_package()
