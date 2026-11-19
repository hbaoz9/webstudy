<?php

return [
    // Explicit release controls. Never enabled by a migration or deployment default.
    'creation_enabled' => env('DISTRIBUTION_CREATION_ENABLED', false),
    'student_visibility_enabled' => env('STUDENT_DISTRIBUTION_VISIBILITY_ENABLED', false),
    'student_attempt_enabled' => env('STUDENT_ATTEMPT_ENABLED', false),
];
