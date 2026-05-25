package main

import "testing"

func TestWantsHelp(t *testing.T) {
	cases := []struct {
		name string
		args []string
		want bool
	}{
		{"empty args", nil, false},
		{"no help flag", []string{"--parallel", "--trace"}, false},
		{"--help anywhere", []string{"--parallel", "--help", "--trace"}, true},
		{"--help at end", []string{"--parallel", "--help"}, true},
		{"-h short flag", []string{"-h"}, true},
		{"literal help subword", []string{"help"}, true},
		{"case insensitive --HELP", []string{"--HELP"}, true},
		{"case insensitive -H", []string{"-H"}, true},
		{"positional containing 'help' is not a match", []string{"./my-helper"}, false},
		{"flag value containing help is not a match", []string{"--name=helper"}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := wantsHelp(tc.args); got != tc.want {
				t.Errorf("wantsHelp(%v) = %v, want %v", tc.args, got, tc.want)
			}
		})
	}
}
