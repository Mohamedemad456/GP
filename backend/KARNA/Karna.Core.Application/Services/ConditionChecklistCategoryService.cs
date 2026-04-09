using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.ConditionChecklistCategory;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Application.Specifications.ConditionChecklistCategories;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Services
{
	internal class ConditionChecklistCategoryService(
		IUnitOfWork _unitOfWork,
		ILocalizationService _localizer,
		IValidator<CreateConditionChecklistCategoryDto> _createValidator,
		IValidator<UpdateConditionChecklistCategoryDto> _updateValidator
		) : IConditionChecklistCategoryService
	{
		public async Task<ApiResponse<ConditionChecklistCategoryDto>> GetByIdAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<ConditionChecklistCategory>();
			var category = await repo.GetAsync(id);

			if (category is null)
				return new ApiResponse<ConditionChecklistCategoryDto> 
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionChecklistCategoryNotFound") 
				};

			return new ApiResponse<ConditionChecklistCategoryDto> 
			{
				Success = true,
				Data = category.ToDto() 
			};
		}

		public async Task<ApiResponse<IEnumerable<ConditionChecklistCategoryDto>>> GetAllAsync()
		{
			var repo = _unitOfWork.GetRepository<ConditionChecklistCategory>();
			var categories = await repo.GetAllAsync();

			return new ApiResponse<IEnumerable<ConditionChecklistCategoryDto>> 
			{
				Success = true,
				Data = categories.ToDto() 
			};
		}

		public async Task<ApiResponse<IEnumerable<ConditionChecklistCategoryDto>>> GetAllActiveAsync()
		{
			var repo = _unitOfWork.GetRepository<ConditionChecklistCategory>();
			var categories = await repo.GetAllWithSpecAsync(new ActiveConditionChecklistCategoriesSpecification());

			return new ApiResponse<IEnumerable<ConditionChecklistCategoryDto>> 
			{
				Success = true,
				Data = categories.ToDto() 
			};
		}

		public async Task<ApiResponse<ConditionChecklistCategoryDto>> CreateAsync(CreateConditionChecklistCategoryDto dto)
		{
			var validationResult = await _createValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<ConditionChecklistCategoryDto> 
				{ 
					Success = false, 
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage)) 
				};

			var repo = _unitOfWork.GetRepository<ConditionChecklistCategory>();

			var existing = await repo.GetAsync(c => c.Name == dto.Name || c.NameAr == dto.NameAr);
			if (existing is not null)
				return new ApiResponse<ConditionChecklistCategoryDto> 
				{ 
					Success = false, 
					Message = _localizer.GetValidationMessage("ConditionChecklistCategoryNameAlreadyExists") 
				};

			var category = dto.ToEntity();

			await repo.AddAsync(category);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ConditionChecklistCategoryDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ConditionChecklistCategoryCreated"),
				Data = category.ToDto()
			};
		}

		public async Task<ApiResponse<ConditionChecklistCategoryDto>> UpdateAsync(Guid id, UpdateConditionChecklistCategoryDto dto)
		{
			var validationResult = await _updateValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
				return new ApiResponse<ConditionChecklistCategoryDto> 
				{ 
					Success = false, 
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage)) 
				};

			var repo = _unitOfWork.GetRepository<ConditionChecklistCategory>();
			var category = await repo.GetAsync(id);

			if (category is null)
				return new ApiResponse<ConditionChecklistCategoryDto> 
				{ 
					Success = false, 
					Message = _localizer.GetErrorMessage("ConditionChecklistCategoryNotFound") 
				};

			var duplicate = await repo.GetAsync(c => (c.Name == dto.Name || c.NameAr == dto.NameAr) && c.Id != id);
			if (duplicate is not null)
				return new ApiResponse<ConditionChecklistCategoryDto> 
				{ 
					Success = false, 
					Message = _localizer.GetValidationMessage("ConditionChecklistCategoryNameAlreadyExists") 
				};

			dto.ApplyTo(category);

			repo.Update(category);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ConditionChecklistCategoryDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ConditionChecklistCategoryUpdated"),
				Data = category.ToDto()
			};
		}

		public async Task<ApiResponseDto> DeleteAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<ConditionChecklistCategory>();
			var category = await repo.GetAsync(id);

			if (category is null)
				return new ApiResponseDto 
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionChecklistCategoryNotFound") 
				};

			repo.Delete(category);
			await _unitOfWork.CompleteAsync();

			return new ApiResponseDto 
			{
				Success = true,
				Message = _localizer.GetMessage("ConditionChecklistCategoryDeleted") 
			};
		}

		public async Task<ApiResponseDto> ActivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<ConditionChecklistCategory>();
			var category = await repo.GetAsync(id);

			if (category is null)
				return new ApiResponseDto 
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionChecklistCategoryNotFound") 
				};

			if (!category.IsActive)
			{
				category.IsActive = true;
				repo.Update(category);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto 
			{ 
				Success = true, 
				Message = _localizer.GetMessage("ConditionChecklistCategoryActivated") 
			};
		}

		public async Task<ApiResponseDto> DeactivateAsync(Guid id)
		{
			var repo = _unitOfWork.GetRepository<ConditionChecklistCategory>();
			var category = await repo.GetAsync(id);

			if (category is null)
				return new ApiResponseDto 
				{ 
					Success = false, 
					Message = _localizer.GetErrorMessage("ConditionChecklistCategoryNotFound") 
				};

			if (category.IsActive)
			{
				category.IsActive = false;
				repo.Update(category);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto 
			{ 
				Success = true, 
				Message = _localizer.GetMessage("ConditionChecklistCategoryDeactivated") 
			};
		}
	}
}