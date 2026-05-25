package integrate

import "testing"

func TestInitExpo(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json": `{"dependencies":{"expo":"51","react-native":"0.74"},"scripts":{"test":"jest","lint":"eslint ."}}`,
		"app.json":     `{"expo":{"name":"myapp"}}`,
	})
	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "build"); s == nil || !hasCheck(s, "expo-export") {
		t.Fatal("expected expo-export in build stage")
	}
	if s := hasStage(pipe, "lint"); s == nil || !hasCheck(s, "expo-doctor") {
		t.Fatal("expected expo-doctor in lint stage")
	}
	if s := hasStage(pipe, "test"); s == nil || !hasCheck(s, "expo-test") {
		t.Fatal("expected expo-test in test stage")
	}
}

func TestInitElectron(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json": `{"dependencies":{"electron":"28"},"scripts":{"build":"electron-builder","test":"jest","lint":"eslint ."}}`,
	})
	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "build"); s == nil || !hasCheck(s, "electron-build") {
		t.Fatal("expected electron-build check")
	}
	if s := hasStage(pipe, "test"); s == nil || !hasCheck(s, "electron-test") {
		t.Fatal("expected electron-test check")
	}
}

func TestInitAngular(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json": `{"dependencies":{"angular":"17"},"scripts":{"build":"ng build","test":"ng test","lint":"ng lint"}}`,
	})
	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "build"); s == nil || !hasCheck(s, "angular-build") {
		t.Fatal("expected angular-build check")
	}
}

func TestInitVue(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json": `{"dependencies":{"vue":"3"},"scripts":{"build":"vite build","test":"vitest"}}`,
	})
	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "build"); s == nil || !hasCheck(s, "vue-build") {
		t.Fatal("expected vue-build check")
	}
	if s := hasStage(pipe, "test"); s == nil || !hasCheck(s, "vue-test") {
		t.Fatal("expected vue-test check")
	}
}

func TestInitCRA(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json": `{"dependencies":{"react-scripts":"5"},"scripts":{"build":"react-scripts build","test":"react-scripts test"}}`,
	})
	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "build"); s == nil || !hasCheck(s, "cra-build") {
		t.Fatal("expected cra-build check")
	}
}

func TestInitT3(t *testing.T) {
	dir := setupRepo(t, map[string]string{
		"package.json": `{"dependencies":{"create-t3-app":"1"},"scripts":{"build":"next build","test":"vitest"}}`,
	})
	pipe, _ := scanAndBuild(dir)
	if s := hasStage(pipe, "build"); s == nil || !hasCheck(s, "t3-build") {
		t.Fatal("expected t3-build check")
	}
}
