cmake_minimum_required(VERSION 3.16)
project(cloud_web_bridge)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(std_msgs REQUIRED)

add_executable(cloud_web_bridge_node
  src/cloud_web_bridge_node.cpp
)

ament_target_dependencies(cloud_web_bridge_node
  rclcpp
  sensor_msgs
  nav_msgs
  std_msgs
)

install(TARGETS cloud_web_bridge_node
  DESTINATION lib/${PROJECT_NAME}
)

install(DIRECTORY config launch
  DESTINATION share/${PROJECT_NAME}/
)

ament_package()
