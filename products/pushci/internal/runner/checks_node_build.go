package runner

func nodeBuildCheck(fw string) *check {
	switch fw {
	case "nextjs":
		return &check{"build", "npx", []string{"next", "build"}}
	case "nuxt":
		return &check{"build", "npx", []string{"nuxt", "build"}}
	case "sveltekit":
		return &check{"build", "npx", []string{"svelte-kit", "build"}}
	case "astro":
		return &check{"build", "npx", []string{"astro", "build"}}
	case "gatsby":
		return &check{"build", "npx", []string{"gatsby", "build"}}
	case "docusaurus":
		return &check{"build", "npx", []string{"docusaurus", "build"}}
	case "storybook":
		return &check{"build", "npx", []string{"storybook", "build"}}
	case "angular":
		return &check{"build", "npx", []string{"ng", "build"}}
	case "cra":
		return &check{"build", "npx", []string{"react-scripts", "build"}}
	case "vite", "":
		return &check{"build", "npx", []string{"vite", "build"}}
	}
	return &check{"build", "npx", []string{"vite", "build"}}
}
