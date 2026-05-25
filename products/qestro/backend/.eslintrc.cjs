module.exports = {
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    root: true,
    env: {
        node: true,
        es2022: true,
    },
    ignorePatterns: ["dist/", "node_modules/", "coverage/"],
    rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "no-case-declarations": "off",
        "@typescript-eslint/no-var-requires": "off",
        "no-useless-escape": "off",
        "no-useless-catch": "off",
        "no-empty": "off",
        "@typescript-eslint/no-this-alias": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "prefer-rest-params": "off",
        "@typescript-eslint/ban-types": "off",
        "@typescript-eslint/no-namespace": "off"
    }
};
