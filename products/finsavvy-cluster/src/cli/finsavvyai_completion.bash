#!/bin/bash
# FinSavvyAI AWS-style CLI completion script
# Place in /etc/bash_completion.d/ or source in ~/.bashrc

_finsavvyai_completion() {
    local cur prev words cword
    _init_completion || return

    # Main commands
    local commands="describe start stop deploy test monitor help"

    # Describe subcommands
    local describe_subcommands="clusters nodes services"

    # Service types
    local service_types="all master worker"

    # Output formats
    local output_formats="json table yaml text"

    case "${prev}" in
        finsavvyai|aws)
            COMPREPLY=($(compgen -W "${commands}" -- "${cur}"))
            ;;
        describe)
            COMPREPLY=($(compgen -W "${describe_subcommands}" -- "${cur}"))
            ;;
        start|stop)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "service" -- "${cur}"))
            elif [[ ${cword} -eq 3 ]]; then
                COMPREPLY=($(compgen -W "${service_types}" -- "${cur}"))
            fi
            ;;
        --region)
            COMPREPLY=($(compgen -W "home-cluster-1 us-east-1 us-west-2 eu-west-1" -- "${cur}"))
            ;;
        --output)
            COMPREPLY=($(compgen -W "${output_formats}" -- "${cur}"))
            ;;
        --profile)
            COMPREPLY=($(compgen -W "default development production staging" -- "${cur}"))
            ;;
        *)
            # Global options
            local global_options="--region --output --profile --verbose --no-color"
            COMPREPLY=($(compgen -W "${global_options}" -- "${cur}"))
            ;;
    esac
}

complete -F _finsavvyai_completion finsavvyai
complete -F _finsavvyai_completion aws finsavvyai

# Aliases for convenience
alias fs='finsavvyai'
alias fs-desc='finsavvyai describe'
alias fs-nodes='finsavvyai describe nodes'
alias fs-clusters='finsavvyai describe clusters'
alias fs-status='finsavvyai describe services'
alias fs-start='finsavvyai start service'
alias fs-stop='finsavvyai stop service'
