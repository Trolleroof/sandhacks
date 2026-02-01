cmake_minimum_required(VERSION 3.8)
project(spatial_detection)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# find dependencies
find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(cv_bridge REQUIRED)
find_package(OpenCV REQUIRED)

# depthai is installed via pip (depthai) or from source;
# its CMake config is typically on the system path already.
find_package(depthai REQUIRED)

# executable
add_executable(spatial_detection_node
  src/spatial_detection_node.cpp
)

ament_target_dependencies(spatial_detection_node
  rclcpp
  sensor_msgs
  std_msgs
  cv_bridge
  OpenCV
)

# depthai exposes its own targets — link directly rather than via ament
target_link_libraries(spatial_detection_node
  depthai::core
  depthai::opencv
)

# install
install(TARGETS spatial_detection_node
  DESTINATION lib/${PROJECT_NAME}
)

if(BUILD_TESTING)
  find_package(ament_lint_auto REQUIRED)
  set(ament_cmake_copyright_FOUND TRUE)
  set(ament_cmake_cpplint_FOUND TRUE)
  ament_lint_auto_find_test_dependencies()
endif()

ament_package()
