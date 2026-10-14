from app.geometry import pose_accepts


def test_front_is_a_narrow_window():
    assert pose_accepts("front", yaw=-1.7, pitch=-10, roll=5)
    assert not pose_accepts("front", yaw=-20, pitch=0, roll=0)


def test_turns_use_the_subject_left_and_right():
    assert pose_accepts("right", yaw=-20.5, pitch=0, roll=0)
    assert pose_accepts("left", yaw=23, pitch=0, roll=0)
    assert not pose_accepts("left", yaw=-20, pitch=0, roll=0)
    assert not pose_accepts("right", yaw=20, pitch=0, roll=0)


def test_extreme_pitch_is_rejected():
    assert not pose_accepts("front", yaw=0, pitch=45, roll=0)
