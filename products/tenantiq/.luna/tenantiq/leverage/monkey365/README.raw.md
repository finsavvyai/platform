<p align="center">
  <img src="https://user-images.githubusercontent.com/5271640/181045413-1d17333c-0533-404a-91be-2070ccc6ee29.png" width="300" height="300" />
</p>

<p align="center">
  <a href="https://github.com/silverhack/monkey365/releases"><img src="https://img.shields.io/github/v/release/silverhack/monkey365?display_name=tag&sort=semver" alt="GitHub release"></a>
  <a href="https://www.powershellgallery.com/packages/monkey365/"><img src="https://img.shields.io/powershellgallery/v/monkey365" alt="PowerShell Gallery"></a>
  <a href="https://github.com/silverhack/monkey365/stargazers"><img src="https://img.shields.io/github/stars/silverhack/monkey365?style=social" alt="Stars"></a>
  <a href="https://twitter.com/tr1ana"><img src="https://img.shields.io/twitter/follow/tr1ana?style=social" alt="Follow @tr1ana"></a>
</p>

<p align="center">
<a href="https://github.com/silverhack/monkey365/issues"><img alt="Issues" src="https://img.shields.io/github/issues/silverhack/monkey365"></a>
<a href="https://github.com/silverhack/monkey365/blob/main/LICENSE"><img src="https://img.shields.io/github/license/silverhack/monkey365" alt="License"></a>
</p>

<p align="center">
  <a href="https://github.com/silverhack/monkey365/releases"><img src="https://img.shields.io/github/downloads/silverhack/monkey365/total?style=flat&logo=powershell&label=GitHub%20Release%20Download" alt="GitHub Downloads"></a>
  <a href="https://www.powershellgallery.com/packages/monkey365"><img src="https://img.shields.io/powershellgallery/dt/monkey365.svg?style=flat&logo=powershell&label=PSGallery%20Download" alt="PowerShell Gallery Downloads"></a>
</p>

*Monkey365* is an Open Source security tool that can be used to easily conduct not only Microsoft 365, but also Azure subscriptions and Microsoft Entra ID security configuration reviews without the significant overhead of learning tool APIs or complex admin panels from the start. To help with this effort, Monkey365 also provides several ways to identify security gaps in the desired tenant setup and configuration. Monkey365 provides valuable recommendations on how to best configure those settings to get the most out of your Microsoft 365 tenant or Azure subscription.

# Introduction

Monkey365 is a collector-based PowerShell module that can be used to review the security posture of your cloud environment. With Monkey365 you can scan for potential misconfigurations and security issues in public cloud accounts according to security best practices and compliance standards, across Azure, Microsoft Entra ID, and Microsoft 365 core applications.

## Installation

### PowerShell Gallery

You can install Monkey365 using the built-in `Install-Module` command. The examples below will install Monkey365 in your  <a href="https://learn.microsoft.com/en-us/powershell/module/powershellget/install-module?view=powershellget-3.x#-scope" target="_blank">installation scope</a> depending on your PowerShell version. You can control this using the `-Scope <AllUsers/CurrentUser>` parameter.

``` powershell
Install-Module -Name monkey365 -Scope CurrentUser
```

To install a beta version, you can use the following command:

``` powershell
Install-Module -Name monkey365 -Scope CurrentUser -AllowPrerelease
```

To update monkey365:

``` powershell
Update-Module -Name monkey365 -Scope CurrentUser
```

To force install monkey365:

``` powershell
Install-Module -Name monkey365 -Scope CurrentUser -Force
```

### GitHub

You can download the latest release by clicking [here](https://github.com/silverhack/monkey365/releases). Once downloaded, you must extract the file and extract the files to a suitable directory.

Once downloaded, you must extract the files to a suitable directory. Once you have unzipped the zip file, you can use the PowerShell V3 Unblock-File cmdlet to unblock files:

``` powershell
Get-ChildItem -Recurse c:\monkey365 | Unblock-File
```

Once you have installed the monkey365 module on your system, you will likely want to import the module with the Import-Module cmdlet. Assuming that Monkey365 is located in the ```PSModulePath```, PowerShell would load monkey365 into active memory:
``` powershell
Import-Module monkey365
```
If Monkey365 is not located on a ```PSModulePath``` path, you can use an explicit path to import:
``` powershell
Import-Module C:\temp\monkey365
```
You can also use the ```Force``` parameter in case you want to reimport the Monkey365 module into the same session
``` powershell
Import-Module C:\temp\monkey365 -Force
```

## Basic Usage

The following command will provide the list of available command line options:

``` powershell
Get-Help Invoke-Monkey365
```

To get a list of examples use:

``` powershell
Get-Help Invoke-Monkey365 -Examples
```

To get a list of all options and examples with detailed info use:


``` powershell
Get-Help Invoke-Monkey365 -Detailed
```

The following example will retrieve data and metadata from Azure AD and SharePoint Online and then print results. If credentials are not supplied, Monkey365 will prompt for credentials.


``` powershell
$options = @{
    Instance = 'Microsoft365';
    Collect = 'ExchangeOnline';
    PromptBehavior = 'SelectAccount';
    IncludeEntraID = $true;
    ExportTo = 'CSV';
}
Invoke-Monkey365 @options
```

### Running Monkey365 in a National or Gov Cloud Environments

The `-Environment` parameter can be used on `Invoke-Monkey365` to specify the name of the cloud environment to connect to. By default the global cloud (AzurePublic) is used.

Allowed values include:

- AzurePublic (default, if `Environment` parameter is not specified)
- AzureChina
- AzureUSGovernment

```powershell
$options = @{
    Environment = "AzureUSGovernment";
    Instance = 'Microsoft365';
    Collect = @('ExchangeOnline','SharePointOnline');
    PromptBehavior = 'SelectAccount';
    IncludeEntraID = $true;
    ExportTo = "JSON","HTML";
}
Invoke-Monkey365 @options
```

## Regulatory compliance checks

Monkey365 helps streamline the process of performing not only Microsoft 365, but also Azure subscriptions and Microsoft Entra ID Security Reviews.

160+ checks covering industry defined security best practices for Microsoft 365, Azure and Entra ID. 

Monkey365 will help consultants to assess cloud environment and to analyze the risk factors according to controls and best practices. The report will contain structured data for quick checking and verification of the results.

<p align="center">
  <img src="https://silverhack.github.io/monkey365/assets/images/htmlreport.png" />
</p>

## Supported standards

By default, the HTML report shows you the CIS (Center for Internet Security) Benchmark. The CIS Benchmarks for Azure and Microsoft 365 are guidelines for security and compliance best practices.

The following standards are supported by Monkey365:

* CIS Microsoft Azure Foundations Benchmark v3.0.0
* CIS Microsoft Azure Database Services Benchmark v2.0.0
* CIS Microsoft 365 Foundations Benchmark v3.0.0, v4.0.0 and V5.0.0

More standards will be added in next releases (NIST, HIPAA, GDPR, PCI-DSS, etc..) as they are available.

Additional information such as Installation or advanced usage can be found in the following [link](https://silverhack.github.io/monkey365/)


> [!TIP]
> **Give us a Star!** If you find this tool useful, please consider giving it a [star ⭐ on GitHub](https://github.com/silverhack/monkey365)! It helps more people discover the project and keeps it evolving.


## Star History

<a href="https://www.star-history.com/#silverhack/monkey365&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=silverhack/monkey365&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=silverhack/monkey365&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=silverhack/monkey365&type=date&legend=top-left" />
 </picture>
</a>
